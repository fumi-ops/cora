#!/usr/bin/env node

import process from "node:process";
import packageJson from "../package.json" with { type: "json" };

import { runConfigGet, runConfigSet, runConfigUnset } from "./commands/config";
import { runExport } from "./commands/export";
import { runFetch } from "./commands/fetch";
import { runInit } from "./commands/init";
import { runServe } from "./commands/serve";
import { runSourcesList } from "./commands/sources";
import { runValidate } from "./commands/validate";

const VERSION = packageJson.version;

interface ParsedArgv {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgv {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    if (arg.startsWith("--no-")) {
      flags[arg.slice(5)] = false;
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[rawKey] = next;
      i += 1;
      continue;
    }

    flags[rawKey] = true;
  }

  return {
    positionals,
    flags,
  };
}

function printHelp(): void {
  console.log(`Cora — AI Agent-Ready Local-First Dashboards

Usage:
  cora init [--template <name>] [--list-templates] [--force]
  cora serve [--port <n>] [--no-open] [--no-fetch] [--file <path>] [--config <path>]
  cora fetch [--source <id>] [--file <path>] [--config <path>]
  cora validate [--file <path>] [--config <path>]
  cora export [--file <path>] [--out <path>]
  cora sources list [--config <path>]
  cora config set <key> [--value <secret>]
  cora config get <key>
  cora config unset <key>
  cora --version
  cora --help

Docs: https://github.com/fumi-ops/cora
`);
}

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const [command, subcommand, arg1] = argv.positionals;

  if (argv.flags.version === true) {
    console.log(VERSION);
    return;
  }

  if (!command || argv.flags.help || command === "--help") {
    printHelp();
    return;
  }

  switch (command) {
    case "init": {
      await runInit({
        force: argv.flags.force === true,
        template: typeof argv.flags.template === "string" ? argv.flags.template : undefined,
        listTemplates: argv.flags["list-templates"] === true,
      });
      return;
    }

    case "serve": {
      const port = typeof argv.flags.port === "string" ? Number.parseInt(argv.flags.port, 10) : 4242;
      await runServe({
        port,
        open: argv.flags.open !== false,
        fetchOnStart: argv.flags.fetch !== false,
        dashboardPath: typeof argv.flags.file === "string" ? argv.flags.file : undefined,
        configPath: typeof argv.flags.config === "string" ? argv.flags.config : undefined,
        version: VERSION,
      });
      return;
    }

    case "fetch": {
      await runFetch({
        sourceId: typeof argv.flags.source === "string" ? argv.flags.source : undefined,
        dashboardPath: typeof argv.flags.file === "string" ? argv.flags.file : undefined,
        configPath: typeof argv.flags.config === "string" ? argv.flags.config : undefined,
        version: VERSION,
      });
      return;
    }

    case "validate": {
      await runValidate({
        dashboardPath: typeof argv.flags.file === "string" ? argv.flags.file : undefined,
        configPath: typeof argv.flags.config === "string" ? argv.flags.config : undefined,
      });
      return;
    }

    case "export": {
      await runExport({
        dashboardPath: typeof argv.flags.file === "string" ? argv.flags.file : undefined,
        outPath: typeof argv.flags.out === "string" ? argv.flags.out : undefined,
      });
      return;
    }

    case "sources": {
      if (subcommand !== "list") {
        throw new Error("Usage: cora sources list");
      }

      await runSourcesList({
        configPath: typeof argv.flags.config === "string" ? argv.flags.config : undefined,
      });
      return;
    }

    case "config": {
      if (subcommand === "set") {
        await runConfigSet(arg1, typeof argv.flags.value === "string" ? argv.flags.value : undefined);
        return;
      }

      if (subcommand === "get") {
        await runConfigGet(arg1);
        return;
      }

      if (subcommand === "unset") {
        await runConfigUnset(arg1);
        return;
      }

      throw new Error("Usage: cora config set <key> | cora config get <key> | cora config unset <key>");
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
