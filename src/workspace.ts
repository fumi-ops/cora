import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseEnv } from "dotenv";
import YAML from "yaml";

import { configSchema, dashboardSchema } from "./schema";
import type { CacheFile, CoraConfig, DashboardDocument, WorkspacePaths } from "./types";

export interface WorkspaceOptions {
  cwd?: string;
  dashboardPath?: string;
  configPath?: string;
}

export function resolveWorkspacePaths(options: WorkspaceOptions = {}): WorkspacePaths {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  const providedDashboardPath = options.dashboardPath
    ? path.resolve(cwd, options.dashboardPath)
    : undefined;
  const providedConfigPath = options.configPath
    ? path.resolve(cwd, options.configPath)
    : undefined;

  const dashboardPath = providedDashboardPath ?? path.join(cwd, "dashboard.json");
  const configPath = providedConfigPath ?? path.join(cwd, "cora.config.yaml");

  let rootDir = cwd;
  if (providedDashboardPath && providedConfigPath) {
    const dashboardDir = path.dirname(providedDashboardPath);
    const configDir = path.dirname(providedConfigPath);

    if (dashboardDir !== configDir) {
      throw new Error(
        "dashboard.json and cora.config.yaml must be in the same directory when both paths are provided.",
      );
    }

    rootDir = dashboardDir;
  } else if (providedDashboardPath) {
    rootDir = path.dirname(providedDashboardPath);
  } else if (providedConfigPath) {
    rootDir = path.dirname(providedConfigPath);
  }

  return {
    rootDir,
    dashboardPath,
    configPath,
    cachePath: path.join(rootDir, "cora.cache.json"),
    envPath: path.join(rootDir, ".env"),
    agentInstructionsPath: path.join(rootDir, "CORA_AGENT_INSTRUCTIONS.md"),
  };
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureWorkspaceDirectory(rootDir: string): Promise<void> {
  await mkdir(rootDir, { recursive: true });
}

export async function readDashboard(paths: WorkspacePaths): Promise<DashboardDocument> {
  const raw = await readFile(paths.dashboardPath, "utf8");
  const parsed = JSON.parse(raw);
  return dashboardSchema.parse(parsed);
}

export async function writeDashboard(paths: WorkspacePaths, dashboard: DashboardDocument): Promise<void> {
  const validated = dashboardSchema.parse(dashboard);
  await writeFile(paths.dashboardPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

export async function readConfig(paths: WorkspacePaths): Promise<CoraConfig> {
  const raw = await readFile(paths.configPath, "utf8");
  const parsed = YAML.parse(raw) ?? {};
  return configSchema.parse(parsed);
}

export async function writeConfig(paths: WorkspacePaths, config: CoraConfig): Promise<void> {
  const validated = configSchema.parse(config);
  await writeFile(paths.configPath, YAML.stringify(validated), "utf8");
}

export async function readCache(paths: WorkspacePaths): Promise<CacheFile> {
  if (!(await fileExists(paths.cachePath))) {
    return { sources: {} };
  }

  const raw = await readFile(paths.cachePath, "utf8");
  try {
    const parsed = JSON.parse(raw) as CacheFile & {
      sources?: Record<string, { last_fetched?: string; lastFetched?: string }>;
    };

    const normalizedSources: CacheFile["sources"] = {};

    for (const [sourceId, entry] of Object.entries(parsed.sources ?? {})) {
      const timestamp = entry.last_fetched ?? entry.lastFetched;
      if (!timestamp) {
        continue;
      }

      normalizedSources[sourceId] = {
        last_fetched: timestamp,
      };
    }

    return {
      sources: normalizedSources,
    };
  } catch {
    return { sources: {} };
  }
}

export async function writeCache(paths: WorkspacePaths, cache: CacheFile): Promise<void> {
  await writeFile(paths.cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function loadProjectEnv(paths: WorkspacePaths): Promise<Record<string, string>> {
  if (!(await fileExists(paths.envPath))) {
    return {};
  }

  const raw = await readFile(paths.envPath, "utf8");
  return parseEnv(raw);
}

export async function appendGitignoreEntries(rootDir: string, entries: string[]): Promise<void> {
  const gitignorePath = path.join(rootDir, ".gitignore");
  const exists = await fileExists(gitignorePath);

  if (!exists) {
    await writeFile(gitignorePath, `${entries.join("\n")}\n`, "utf8");
    return;
  }

  const current = await readFile(gitignorePath, "utf8");
  const lines = new Set(current.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const missing = entries.filter((entry) => !lines.has(entry));

  if (missing.length === 0) {
    return;
  }

  const separator = current.endsWith("\n") ? "" : "\n";
  await writeFile(gitignorePath, `${current}${separator}${missing.join("\n")}\n`, "utf8");
}
