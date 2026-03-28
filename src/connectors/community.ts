import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { SourceConfig } from "../types";
import type { Connector, NamedQueryHandler } from "./types";

interface CommunitySpecConnector {
  id: string;
  fetch: (query: string, auth: Record<string, string>) => Promise<unknown>;
  namedQueries?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

const COMMUNITY_PREFIX = "cora-connector-";
const EXCLUDED_AUTH_KEYS = new Set(["id", "type", "refresh"]);
const discoveryCache = new Map<string, Promise<Record<string, Connector>>>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInternalConnector(candidate: unknown): candidate is Connector {
  if (!isObject(candidate)) {
    return false;
  }

  return typeof candidate.type === "string" && typeof candidate.execute === "function";
}

function isCommunitySpecConnector(candidate: unknown): candidate is CommunitySpecConnector {
  if (!isObject(candidate)) {
    return false;
  }

  return typeof candidate.id === "string" && typeof candidate.fetch === "function";
}

function extractSourceAuth(source: SourceConfig): Record<string, string> {
  const auth: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (EXCLUDED_AUTH_KEYS.has(key)) {
      continue;
    }

    if (typeof value === "string") {
      auth[key] = value;
    }
  }

  return auth;
}

function normalizeNamedQueries(
  namedQueries: CommunitySpecConnector["namedQueries"],
): Record<string, NamedQueryHandler> | undefined {
  if (!namedQueries || typeof namedQueries !== "object") {
    return undefined;
  }

  const resolved: Record<string, NamedQueryHandler> = {};

  for (const [name, handler] of Object.entries(namedQueries)) {
    if (typeof handler !== "function") {
      continue;
    }

    resolved[name] = async (source) => {
      const auth = extractSourceAuth(source);
      return handler(source, auth);
    };
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function toConnector(candidate: unknown): Connector | null {
  if (isInternalConnector(candidate)) {
    return candidate;
  }

  if (isCommunitySpecConnector(candidate)) {
    return {
      type: candidate.id,
      namedQueries: normalizeNamedQueries(candidate.namedQueries),
      async execute({ source, query }) {
        return candidate.fetch(query, extractSourceAuth(source));
      },
    };
  }

  return null;
}

function extractConnectorsFromModule(moduleValue: unknown): Connector[] {
  if (!isObject(moduleValue)) {
    return [];
  }

  const candidates: unknown[] = [];

  if ("default" in moduleValue) {
    candidates.push(moduleValue.default);
  }

  if ("connector" in moduleValue) {
    candidates.push(moduleValue.connector);
  }

  if ("connectors" in moduleValue) {
    const rawConnectors = moduleValue.connectors;
    if (Array.isArray(rawConnectors)) {
      candidates.push(...rawConnectors);
    } else {
      candidates.push(rawConnectors);
    }
  }

  candidates.push(moduleValue);

  const connectors: Connector[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const connector = toConnector(candidate);
    if (!connector || seen.has(connector.type)) {
      continue;
    }

    seen.add(connector.type);
    connectors.push(connector);
  }

  return connectors;
}

async function findCommunityPackageDirs(rootDir: string): Promise<string[]> {
  const nodeModulesPath = path.join(rootDir, "node_modules");
  let entries: Dirent[];

  try {
    entries = await readdir(nodeModulesPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const packageDirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith(COMMUNITY_PREFIX)) {
      packageDirs.push(path.join(nodeModulesPath, entry.name));
      continue;
    }

    if (!entry.name.startsWith("@")) {
      continue;
    }

    const scopePath = path.join(nodeModulesPath, entry.name);
    let scopedEntries: Dirent[];

    try {
      scopedEntries = await readdir(scopePath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const scopedEntry of scopedEntries) {
      if (scopedEntry.isDirectory() && scopedEntry.name.startsWith(COMMUNITY_PREFIX)) {
        packageDirs.push(path.join(scopePath, scopedEntry.name));
      }
    }
  }

  packageDirs.sort((a, b) => a.localeCompare(b));
  return packageDirs;
}

async function discover(rootDir: string): Promise<Record<string, Connector>> {
  const packageDirs = await findCommunityPackageDirs(rootDir);
  const connectors: Record<string, Connector> = {};

  for (const packageDir of packageDirs) {
    try {
      const moduleUrl = pathToFileURL(packageDir).href;
      const imported = await import(moduleUrl);
      const resolvedConnectors = extractConnectorsFromModule(imported);

      for (const connector of resolvedConnectors) {
        if (connectors[connector.type]) {
          continue;
        }

        connectors[connector.type] = connector;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: unable to load community connector package at ${packageDir}: ${message}`);
    }
  }

  return connectors;
}

export async function discoverCommunityConnectors(rootDir: string): Promise<Record<string, Connector>> {
  const normalizedRoot = path.resolve(rootDir);

  const cached = discoveryCache.get(normalizedRoot);
  if (cached) {
    return cached;
  }

  const pending = discover(normalizedRoot);
  discoveryCache.set(normalizedRoot, pending);
  return pending;
}
