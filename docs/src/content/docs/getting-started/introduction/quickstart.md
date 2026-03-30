---
title: Quickstart
description: Install Cora, initialize a workspace, and start serving a dashboard locally.
---

## 1. Install dependencies

```bash
bun install
```

If you are using the published package instead of the repo checkout:

```bash
npm install -g @fumi-ops/cora
```

## 2. Create a workspace

Pick a template that matches the dashboard you want to build:

```bash
bun run src/cli.ts init --template saas
```

Templates include:

- `starter`
- `saas`
- `ecommerce`
- `freelancer`
- `developer`

## 3. Start the local server

```bash
bun run src/cli.ts serve
```

Then open `http://127.0.0.1:4242`.

## 4. Refresh data

```bash
bun run src/cli.ts fetch
```

Use `validate` before you ship a dashboard layout:

```bash
bun run src/cli.ts validate
```

## What the starter creates

- `dashboard.json` for rendered values
- `cora.config.yaml` for source bindings and refresh behavior
- `cora.cache.json` for local cache state
- `.env` for project credentials
- `CORA_AGENT_INSTRUCTIONS.md` for the agent contract

## Useful commands

```bash
cora init
cora serve
cora fetch
cora validate
cora export
cora sources list
cora config get <key>
```
