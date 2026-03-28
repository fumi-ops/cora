import type { SourceConfig, SourceType } from "../types";

export interface ConnectorExecution {
  source: SourceConfig;
  query: string;
}

export type NamedQueryHandler = (source: SourceConfig) => Promise<unknown>;

export interface Connector {
  type: SourceType;
  namedQueries?: Record<string, NamedQueryHandler>;
  execute(execution: ConnectorExecution): Promise<unknown>;
}
