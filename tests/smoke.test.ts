import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { pathToFileURL } from "node:url";

import { CoraRuntime } from "../src/runtime/runtime";
import { resolveWorkspacePaths } from "../src/workspace";
import { sanitizeHtml } from "../ui/src/lib/sanitize-html";

describe("sanitization", () => {
  test("removes unsafe markup from rendered markdown HTML", () => {
    const html = sanitizeHtml(
      `<p onclick="alert(1)">Hello</p><a href="javascript:alert(1)">Open</a><img src="/ok.png" onerror="alert(1)" /><script>alert(1)</script>`,
    );

    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain(">Open</a>");
    expect(html).toContain('src="/ok.png"');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
  });
});

describe("runtime refresh locking", () => {
  test("serializes concurrent refresh calls to avoid overlapping connector execution", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-smoke-"));
    const connectorDir = path.join(workspaceDir, "node_modules", "cora-connector-slow");
    const dashboardPath = path.join(workspaceDir, "dashboard.json");
    const configPath = path.join(workspaceDir, "cora.config.yaml");
    const cachePath = path.join(workspaceDir, "cora.cache.json");

    await mkdir(connectorDir, { recursive: true });

    await writeFile(
      path.join(connectorDir, "package.json"),
      `${JSON.stringify(
        {
          name: "cora-connector-slow",
          type: "module",
          main: "./index.js",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      path.join(connectorDir, "index.js"),
      `let active = 0;
let maxConcurrent = 0;
let requests = 0;

export function getConnectorStats() {
  return { maxConcurrent, requests };
}

const connector = {
  type: "slow",
  async execute() {
    requests += 1;
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    await new Promise((resolve) => setTimeout(resolve, 75));
    active -= 1;
    return [{ value: 123 }];
  },
};

export default connector;
`,
      "utf8",
    );

    await writeFile(
      dashboardPath,
      `${JSON.stringify(
        {
          title: "Smoke",
          updated: new Date().toISOString(),
          widgets: [
            {
              id: "metric_1",
              type: "metric",
              label: "Metric",
              value: 0,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      configPath,
      `sources:
  - id: api
    type: slow
    refresh: every 1m
widgets:
  - id: metric_1
    source: api
    query: anything
`,
      "utf8",
    );

    await writeFile(cachePath, `${JSON.stringify({ sources: {} }, null, 2)}\n`, "utf8");

    const runtime = new CoraRuntime({
      paths: resolveWorkspacePaths({ cwd: workspaceDir }),
      version: "smoke",
    });

    try {
      await Promise.all([runtime.refresh({ force: true }), runtime.refresh({ force: true })]);

      const connectorModule = (await import(pathToFileURL(connectorDir).href)) as {
        getConnectorStats: () => { maxConcurrent: number; requests: number };
      };

      const updatedDashboard = JSON.parse(await readFile(dashboardPath, "utf8")) as {
        widgets: Array<{ id: string; value: unknown }>;
      };

      expect(connectorModule.getConnectorStats().maxConcurrent).toBe(1);
      expect(connectorModule.getConnectorStats().requests).toBe(2);
      expect(updatedDashboard.widgets[0]?.value).toBe(123);
    } finally {
      runtime.dispose();
    }
  });
});

describe("workspace path resolution", () => {
  test("uses overridden dashboard/config directory as workspace root", () => {
    const cwd = path.join(os.tmpdir(), "cora-workspace-paths");

    const dashboardOnly = resolveWorkspacePaths({
      cwd,
      dashboardPath: "nested/dashboard.json",
    });

    expect(dashboardOnly.rootDir).toBe(path.join(cwd, "nested"));
    expect(dashboardOnly.cachePath).toBe(path.join(cwd, "nested", "cora.cache.json"));
    expect(dashboardOnly.envPath).toBe(path.join(cwd, "nested", ".env"));

    const configOnly = resolveWorkspacePaths({
      cwd,
      configPath: "project/cora.config.yaml",
    });

    expect(configOnly.rootDir).toBe(path.join(cwd, "project"));
    expect(configOnly.cachePath).toBe(path.join(cwd, "project", "cora.cache.json"));
  });

  test("throws when dashboard and config are in different directories", () => {
    const cwd = path.join(os.tmpdir(), "cora-workspace-paths");
    expect(() =>
      resolveWorkspacePaths({
        cwd,
        dashboardPath: "a/dashboard.json",
        configPath: "b/cora.config.yaml",
      }),
    ).toThrow("must be in the same directory");
  });
});

describe("runtime partial source failures", () => {
  test("keeps successful widgets updated when sibling bindings fail", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-smoke-partial-"));
    const connectorDir = path.join(workspaceDir, "node_modules", "cora-connector-partial");
    const dashboardPath = path.join(workspaceDir, "dashboard.json");
    const configPath = path.join(workspaceDir, "cora.config.yaml");
    const cachePath = path.join(workspaceDir, "cora.cache.json");

    await mkdir(connectorDir, { recursive: true });

    await writeFile(
      path.join(connectorDir, "package.json"),
      `${JSON.stringify(
        {
          name: "cora-connector-partial",
          type: "module",
          main: "./index.js",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      path.join(connectorDir, "index.js"),
      `const connector = {
  type: "partial",
  async execute({ query }) {
    if (query === "fail") {
      throw new Error("connector failure");
    }
    return [{ value: 321 }];
  },
};

export default connector;
`,
      "utf8",
    );

    await writeFile(
      dashboardPath,
      `${JSON.stringify(
        {
          title: "Partial",
          updated: new Date().toISOString(),
          widgets: [
            {
              id: "metric_ok",
              type: "metric",
              label: "OK",
              value: 0,
            },
            {
              id: "metric_fail",
              type: "metric",
              label: "FAIL",
              value: 0,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      configPath,
      `sources:
  - id: api
    type: partial
    refresh: every 1m
widgets:
  - id: metric_ok
    source: api
    query: ok
  - id: metric_fail
    source: api
    query: fail
`,
      "utf8",
    );

    await writeFile(cachePath, `${JSON.stringify({ sources: {} }, null, 2)}\n`, "utf8");

    const runtime = new CoraRuntime({
      paths: resolveWorkspacePaths({ cwd: workspaceDir }),
      version: "smoke",
    });

    try {
      await runtime.refresh({ force: true });

      const updatedDashboard = JSON.parse(await readFile(dashboardPath, "utf8")) as {
        widgets: Array<{ id: string; value: unknown }>;
      };
      const byId = new Map(updatedDashboard.widgets.map((widget) => [widget.id, widget.value]));
      const state = runtime.getState();

      expect(byId.get("metric_ok")).toBe(321);
      expect(byId.get("metric_fail")).toBe(0);
      expect(state.widgetErrors.metric_ok).toBeUndefined();
      expect(state.widgetErrors.metric_fail).toContain("connector failure");
      expect(state.sourceStatuses.api.cacheStatus).toBe("fresh");
      expect(state.sourceStatuses.api.error).toContain("metric_fail: connector failure");
    } finally {
      runtime.dispose();
    }
  });
});
