import { applyJsonPath } from "./json-path";
import { discoverCommunityConnectors } from "./community";
import { duckdbConnector } from "./duckdb";
import { githubConnector } from "./github";
import { httpConnector } from "./http";
import { mysqlConnector } from "./mysql";
import { plausibleConnector } from "./plausible";
import { postgresConnector } from "./postgres";
import { sqliteConnector } from "./sqlite";
import { stripeConnector } from "./stripe";
import type { Connector } from "./types";
import type { SourceConfig } from "../types";

const builtInConnectors: Record<string, Connector> = {
  postgres: postgresConnector,
  mysql: mysqlConnector,
  sqlite: sqliteConnector,
  duckdb: duckdbConnector,
  http: httpConnector,
  stripe: stripeConnector,
  plausible: plausibleConnector,
  github: githubConnector,
};

async function resolveConnector(type: string, rootDir?: string): Promise<Connector> {
  const builtIn = builtInConnectors[type];
  if (builtIn) {
    return builtIn;
  }

  if (rootDir) {
    const communityConnectors = await discoverCommunityConnectors(rootDir);
    const community = communityConnectors[type];
    if (community) {
      return community;
    }
  }

  throw new Error(`Unsupported connector type: ${type}`);
}

export async function isConnectorTypeSupported(type: string, rootDir?: string): Promise<boolean> {
  try {
    await resolveConnector(type, rootDir);
    return true;
  } catch {
    return false;
  }
}

export async function executeConnector(
  source: SourceConfig,
  query: string,
  jsonPath?: string,
  rootDir?: string,
): Promise<unknown> {
  const connector = await resolveConnector(source.type, rootDir);
  const namedQuery = connector.namedQueries?.[query];
  const rawResult = namedQuery
    ? await namedQuery(source)
    : await connector.execute({ source, query });

  if (source.type === "http") {
    const httpResult = rawResult as { data: unknown };
    const selector =
      typeof jsonPath === "string" && jsonPath.length > 0
        ? jsonPath
        : query.trim().startsWith("$")
          ? query
          : undefined;

    return selector ? applyJsonPath(httpResult.data, selector) : httpResult.data;
  }

  return rawResult;
}
