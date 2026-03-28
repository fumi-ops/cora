import { writeFile } from "node:fs/promises";

import type { DashboardWidget } from "../types";
import { readDashboard, resolveWorkspacePaths } from "../workspace";

export interface ExportOptions {
  cwd?: string;
  dashboardPath?: string;
  outPath?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderWidget(widget: DashboardWidget): string {
  switch (widget.type) {
    case "metric":
      return `<section class=\"card\"><h3>${escapeHtml(widget.label)}</h3><p class=\"metric\">${escapeHtml(String(widget.unit ?? ""))}${escapeHtml(String(widget.value))}</p></section>`;

    case "timeseries":
      return `<section class=\"card\"><h3>${escapeHtml(widget.label)}</h3><pre>${escapeHtml(JSON.stringify(widget.data, null, 2))}</pre></section>`;

    case "bar":
      return `<section class=\"card\"><h3>${escapeHtml(widget.label)}</h3><pre>${escapeHtml(JSON.stringify(widget.data, null, 2))}</pre></section>`;

    case "table": {
      const head = widget.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
      const body = widget.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`,
        )
        .join("");

      return `<section class=\"card\"><h3>${escapeHtml(widget.label)}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
    }

    case "text":
      return `<section class=\"card\"><h3>${escapeHtml(widget.label)}</h3><p>${escapeHtml(widget.content)}</p></section>`;

    default:
      return "";
  }
}

export async function runExport(options: ExportOptions = {}): Promise<void> {
  const paths = resolveWorkspacePaths({
    cwd: options.cwd,
    dashboardPath: options.dashboardPath,
  });

  const dashboard = await readDashboard(paths);
  const outPath = options.outPath ?? `${paths.rootDir}/dashboard.export.html`;

  const html = `<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>${escapeHtml(dashboard.title)} - Export</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #0b1117; color: #e8f2ff; }
      .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
      .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
      .card { grid-column: span 4; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; }
      .metric { font-size: 2rem; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px; }
      pre { overflow-x: auto; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div class=\"container\">
      <h1>${escapeHtml(dashboard.title)}</h1>
      <p>Updated ${escapeHtml(dashboard.updated)}</p>
      <div class=\"grid\">${dashboard.widgets.map((widget) => renderWidget(widget)).join("")}</div>
    </div>
  </body>
</html>`;

  await writeFile(outPath, html, "utf8");
  console.log(`Exported dashboard to ${outPath}`);
}
