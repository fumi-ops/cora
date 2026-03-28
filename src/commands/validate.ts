import { isConnectorTypeSupported } from "../connectors";
import { parseRefreshInterval } from "../refresh";
import { readConfig, readDashboard, resolveWorkspacePaths } from "../workspace";

export interface ValidateOptions {
  cwd?: string;
  dashboardPath?: string;
  configPath?: string;
}

export async function runValidate(options: ValidateOptions = {}): Promise<void> {
  const paths = resolveWorkspacePaths({
    cwd: options.cwd,
    dashboardPath: options.dashboardPath,
    configPath: options.configPath,
  });

  const dashboard = await readDashboard(paths);
  const config = await readConfig(paths);

  const dashboardWidgetIds = new Set(dashboard.widgets.map((widget) => widget.id));
  const sourceIds = new Set(config.sources.map((source) => source.id));

  for (const source of config.sources) {
    const supported = await isConnectorTypeSupported(source.type, paths.rootDir);
    if (!supported) {
      throw new Error(`Source ${source.id} uses unsupported connector type ${source.type}.`);
    }

    parseRefreshInterval(source.refresh);
  }

  for (const binding of config.widgets) {
    if (!sourceIds.has(binding.source)) {
      throw new Error(`Widget binding ${binding.id} references missing source ${binding.source}.`);
    }

    if (!dashboardWidgetIds.has(binding.id)) {
      throw new Error(`Widget binding ${binding.id} references missing widget in dashboard.json.`);
    }
  }

  console.log("dashboard.json and cora.config.yaml are valid.");
}
