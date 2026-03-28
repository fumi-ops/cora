import { CoraRuntime } from "../runtime/runtime";
import { resolveWorkspacePaths } from "../workspace";

export interface FetchOptions {
  cwd?: string;
  dashboardPath?: string;
  configPath?: string;
  sourceId?: string;
  version: string;
}

export async function runFetch(options: FetchOptions): Promise<void> {
  const paths = resolveWorkspacePaths({
    cwd: options.cwd,
    dashboardPath: options.dashboardPath,
    configPath: options.configPath,
  });

  const runtime = new CoraRuntime({
    paths,
    version: options.version,
  });

  try {
    await runtime.initialize(false);

    if (options.sourceId) {
      const sourceExists = runtime.config.sources.some((source) => source.id === options.sourceId);
      if (!sourceExists) {
        throw new Error(`Unknown source id: ${options.sourceId}`);
      }
    }

    await runtime.refresh({
      force: true,
      sourceId: options.sourceId,
    });

    console.log(
      options.sourceId
        ? `Fetched source ${options.sourceId} and updated dashboard.`
        : "Fetched all sources and updated dashboard.",
    );
  } finally {
    runtime.dispose();
  }
}
