import { startUiServer } from "../ui-server/server";
import { openBrowser } from "../runtime/open-browser";
import { CoraRuntime } from "../runtime/runtime";
import { resolveWorkspacePaths } from "../workspace";

export interface ServeOptions {
  cwd?: string;
  port?: number;
  open?: boolean;
  fetchOnStart?: boolean;
  dashboardPath?: string;
  configPath?: string;
  version: string;
}

export async function runServe(options: ServeOptions): Promise<void> {
  const paths = resolveWorkspacePaths({
    cwd: options.cwd,
    dashboardPath: options.dashboardPath,
    configPath: options.configPath,
  });

  const runtime = new CoraRuntime({
    paths,
    version: options.version,
  });

  await runtime.initialize(options.fetchOnStart ?? true);

  const port = options.port ?? 4242;
  const { stop } = await startUiServer(runtime, { port });

  const url = `http://127.0.0.1:${port}`;
  console.log(`Cora running at ${url}`);

  if (options.open ?? true) {
    await openBrowser(url);
  }

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      stop();
      runtime.dispose();
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}
