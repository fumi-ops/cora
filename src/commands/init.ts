import { writeFile } from "node:fs/promises";

import {
  createTemplateWorkspace,
  listDashboardTemplates,
  agentInstructionsTemplate,
} from "../templates/starter";
import {
  appendGitignoreEntries,
  ensureWorkspaceDirectory,
  fileExists,
  resolveWorkspacePaths,
  writeConfig,
  writeDashboard,
} from "../workspace";

export interface InitOptions {
  cwd?: string;
  force?: boolean;
  template?: string;
  listTemplates?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  if (options.listTemplates) {
    console.log("Available templates:");
    for (const template of listDashboardTemplates()) {
      console.log(`- ${template.name}: ${template.description}`);
    }
    return;
  }

  const paths = resolveWorkspacePaths({ cwd: options.cwd });

  await ensureWorkspaceDirectory(paths.rootDir);

  const dashboardExists = await fileExists(paths.dashboardPath);
  const configExists = await fileExists(paths.configPath);
  const instructionsExists = await fileExists(paths.agentInstructionsPath);

  if (!options.force && (dashboardExists || configExists)) {
    throw new Error(
      "Workspace already contains dashboard/config files. Re-run with --force to overwrite them.",
    );
  }

  const workspaceTemplate = createTemplateWorkspace(options.template);
  await writeDashboard(paths, workspaceTemplate.dashboard);
  await writeConfig(paths, workspaceTemplate.config);

  if (!instructionsExists || options.force) {
    await writeFile(paths.agentInstructionsPath, agentInstructionsTemplate(), "utf8");
  }

  await appendGitignoreEntries(paths.rootDir, [".env", "cora.cache.json"]);

  console.log("Initialized Cora workspace:");
  console.log(`- Template: ${workspaceTemplate.templateName}`);
  console.log(`- ${paths.dashboardPath}`);
  console.log(`- ${paths.configPath}`);
  console.log(`- ${paths.agentInstructionsPath}`);
}
