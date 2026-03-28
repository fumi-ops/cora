import { chmod, rm, writeFile } from "node:fs/promises";
import path from "node:path";

async function main(): Promise<void> {
  const distDir = path.resolve(process.cwd(), "dist");
  const binPath = path.join(distDir, "cora.js");
  const legacyBinPath = path.join(distDir, "cora");

  await rm(legacyBinPath, { force: true });

  const bin = `#!/usr/bin/env node
await import("./cora.mjs");
`;

  await writeFile(binPath, bin, "utf8");
  await chmod(binPath, 0o755);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
