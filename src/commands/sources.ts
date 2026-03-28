import { isFresh, parseRefreshInterval } from "../refresh";
import { readCache, readConfig, resolveWorkspacePaths } from "../workspace";

export interface SourcesListOptions {
  cwd?: string;
  configPath?: string;
}

export async function runSourcesList(options: SourcesListOptions = {}): Promise<void> {
  const paths = resolveWorkspacePaths({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  const config = await readConfig(paths);
  const cache = await readCache(paths);

  if (config.sources.length === 0) {
    console.log("No sources configured.");
    return;
  }

  const rows = config.sources.map((source) => {
    const refreshMs = parseRefreshInterval(source.refresh);
    const lastFetched = cache.sources[source.id]?.last_fetched ?? "-";
    const cacheStatus =
      lastFetched === "-" ? "missing" : isFresh(lastFetched, refreshMs) ? "fresh" : "stale";

    return {
      id: source.id,
      type: source.type,
      refresh: source.refresh ?? "every 5m",
      lastFetched,
      cacheStatus,
    };
  });

  console.table(rows);
}
