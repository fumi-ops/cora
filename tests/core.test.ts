import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import YAML from "yaml";

import { runExport } from "../src/commands/export";
import { runInit } from "../src/commands/init";
import { CoraRuntime } from "../src/runtime/runtime";
import { resolveWorkspacePaths } from "../src/workspace";

async function createWorkspaceFixture(rootDir: string): Promise<void> {
  await writeFile(
    path.join(rootDir, "dashboard.json"),
    `${JSON.stringify(
      {
        title: "Fixture",
        updated: new Date().toISOString(),
        widgets: [
          {
            id: "mrr",
            type: "metric",
            label: "MRR",
            value: 100,
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    path.join(rootDir, "cora.config.yaml"),
    `sources: []
widgets: []
`,
    "utf8",
  );
}

describe("workspace bootstrap", () => {
  test("creates a valid starter workspace and gitignore entries", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-init-"));

    await runInit({
      cwd: workspaceDir,
      template: "saas",
    });

    const dashboardPath = path.join(workspaceDir, "dashboard.json");
    const configPath = path.join(workspaceDir, "cora.config.yaml");
    const instructionsPath = path.join(workspaceDir, "CORA_AGENT_INSTRUCTIONS.md");
    const gitignorePath = path.join(workspaceDir, ".gitignore");

    const dashboard = JSON.parse(await readFile(dashboardPath, "utf8")) as {
      title: string;
      widgets: Array<{ id: string }>;
    };
    const config = YAML.parse(await readFile(configPath, "utf8")) as {
      sources: Array<{ id: string }>;
      widgets: Array<{ id: string }>;
    };
    const gitignore = await readFile(gitignorePath, "utf8");

    expect(dashboard.title).toBe("SaaS Control Room");
    expect(dashboard.widgets.length).toBeGreaterThan(0);
    expect(config.sources.length).toBeGreaterThan(0);
    expect(config.widgets.length).toBeGreaterThan(0);
    expect(await readFile(instructionsPath, "utf8")).toContain("dashboard.json");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("cora.cache.json");
  });

  test("refuses to overwrite an existing workspace without --force", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-init-guard-"));
    await createWorkspaceFixture(workspaceDir);

    await expect(
      runInit({
        cwd: workspaceDir,
        template: "starter",
      }),
    ).rejects.toThrow("Workspace already contains dashboard/config files");
  });
});

describe("credential storage", () => {
  test("round-trips secrets without leaving plaintext in the encrypted store", async () => {
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "cora-home-"));
    const scriptPath = path.join(tempHome, "credential-check.mjs");
    const projectRoot = process.cwd();
    const credentialModule = path.join(projectRoot, "src", "runtime", "credentials.ts");

    await writeFile(
      scriptPath,
      `import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCredential, setCredential } from "${credentialModule.replaceAll("\\", "\\\\")}";

await setCredential("STRIPE_KEY", "super-secret-value");
const value = await getCredential("STRIPE_KEY");
const storePath = path.join(process.env.HOME, ".cora", "store.enc");
const storeContent = await readFile(storePath, "utf8");

process.stdout.write(JSON.stringify({ value, storeContent }));
`,
      "utf8",
    );

    const result = spawnSync("bun", [scriptPath], {
      env: {
        ...process.env,
        HOME: tempHome,
        USERPROFILE: tempHome,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const parsed = JSON.parse(result.stdout.trim()) as {
      value: string;
      storeContent: string;
    };

    expect(parsed.value).toBe("super-secret-value");
    expect(parsed.storeContent).not.toContain("super-secret-value");
    expect(parsed.storeContent).toContain('"data"');
    expect(parsed.storeContent).toContain('"iv"');
    expect(parsed.storeContent).toContain('"tag"');
  });
});

describe("static export", () => {
  test("escapes dangerous markup in the generated HTML", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-export-"));
    await writeFile(
      path.join(workspaceDir, "dashboard.json"),
      `${JSON.stringify(
        {
          title: `<img src=x onerror=alert(1)>`,
          updated: new Date().toISOString(),
          widgets: [
            {
              id: "notes",
              type: "text",
              label: `<script>alert(1)</script>`,
              content: `<a href="javascript:alert(1)" onclick="alert(2)">hello</a>`,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const outPath = path.join(workspaceDir, "dashboard.export.html");
    await runExport({
      cwd: workspaceDir,
      outPath,
    });

    const html = await readFile(outPath, "utf8");

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<a href="javascript:alert(1)" onclick="alert(2)">hello</a>');
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot;javascript:alert(1)&quot;");
  });
});

describe("agent write boundary", () => {
  test("preserves widget identity while applying a patch", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cora-patch-"));
    await createWorkspaceFixture(workspaceDir);

    const dashboardPath = path.join(workspaceDir, "dashboard.json");
    const before = JSON.parse(await readFile(dashboardPath, "utf8")) as {
      updated: string;
    };

    const runtime = new CoraRuntime({
      paths: resolveWorkspacePaths({ cwd: workspaceDir }),
      version: "test",
    });

    try {
      await runtime.patchWidget("mrr", {
        id: "hijack",
        type: "text",
        value: 250,
        trend: "+15%",
      });

      const after = JSON.parse(await readFile(dashboardPath, "utf8")) as {
        updated: string;
        widgets: Array<{
          id: string;
          type: string;
          value: number;
          trend?: string;
        }>;
      };

      expect(after.updated).not.toBe(before.updated);
      expect(after.widgets[0]).toMatchObject({
        id: "mrr",
        type: "metric",
        value: 250,
        trend: "+15%",
      });
    } finally {
      runtime.dispose();
    }
  });
});
