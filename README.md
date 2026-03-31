# Cora

[![CI](https://github.com/fumi-ops/cora/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fumi-ops/cora/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@fumi-ops/cora.svg)](https://www.npmjs.com/package/@fumi-ops/cora)
[![license](https://img.shields.io/npm/l/@fumi-ops/cora.svg)](https://github.com/fumi-ops/cora/blob/main/LICENSE)
[![local-first](https://img.shields.io/badge/local--first-yes-0ea5e9)](https://github.com/fumi-ops/cora)
[![demo](https://img.shields.io/badge/demo-live-brightgreen)](https://cora.fumi.dev/demo)

AI Agent-Ready Local-First Dashboards.

[![Demo preview](https://github.com/fumi-ops/cora/raw/main/docs/public/demo-preview.jpg)](https://cora.fumi.dev/demo)

Cora is a file-driven dashboard runtime: `dashboard.json` is rendered live, while `cora.config.yaml` defines source bindings and refresh behavior.

The development workflow uses Bun, while the published CLI runs as Node-compatible JavaScript.

## Quick start

```bash
# install all workspace dependencies (CLI + UI + internal packages)
bun install
bun run src/cli.ts init --template saas
bun run src/cli.ts serve
```

Open `http://127.0.0.1:4242`.

Global install target:

```bash
npm install -g @fumi-ops/cora
```

## Workspace files

- `dashboard.json`: rendered dashboard values (agent-writable)
- `cora.config.yaml`: source and widget binding config
- `cora.cache.json`: auto-managed source cache state
- `.env`: optional project credentials
- `CORA_AGENT_INSTRUCTIONS.md`: generated agent contract

## Commands

```bash
cora init [--template <name>] [--list-templates] [--force]
cora serve [--port <n>] [--no-open] [--no-fetch] [--file <path>] [--config <path>]
cora fetch [--source <id>] [--file <path>] [--config <path>]
cora validate [--file <path>] [--config <path>]
cora export [--file <path>] [--out <path>]
cora sources list [--config <path>]
cora config set <key> [--value <secret>]
cora config get <key>
cora config unset <key>
```

Template names:

- `starter`
- `saas`
- `ecommerce`
- `freelancer`
- `developer`

## Connector support

Built-in connectors:

- `postgres`
- `mysql`
- `sqlite`
- `duckdb`
- `http`
- `stripe`
- `plausible`
- `github`

Named query examples:

- Stripe: `mrr`, `arr`, `new_customers_today`, `revenue_mtd`, `churn_rate`, `active_subscriptions`
- Plausible: `visitors_today`, `visitors_mtd`, `top_pages`, `bounce_rate`
- GitHub: `stars`, `open_issues`, `open_prs`, `commits_today`

Credential values are resolved in this order:

1. Shell environment variable
2. Project `.env`
3. Encrypted store `~/.cora/store.enc`

## Community connectors

Cora auto-discovers connector packages from local `node_modules` with the prefix `cora-connector-*` (including scoped packages like `@acme/cora-connector-foo`).

If a source uses `type: foo`, install a package that exports connector `foo` and Cora will load it at runtime.

## Agent write endpoint

Agents can patch a single widget without direct file access:

```http
POST http://127.0.0.1:4242/api/widget
Content-Type: application/json

{ "id": "mrr", "value": 4800, "trend": "+14%" }
```

## Requirements

- Node.js `>=22.13.0`

## UI stack

- React 19
- Basecoat CSS
- Chart.js
- Tailwind CSS
- SSE from the local dashboard server

Develop or build the UI bundle from the root workspace:

```bash
bun run dev:ui
bun run build:ui
bun run check:embedded-ui
```

Validation commands:

```bash
bun run typecheck
bun run lint
bun run test
bun run ci
```

## Security model

- Connector calls run in the local CLI process only.
- Browser never receives credential values.
- Server binds to `127.0.0.1`.
- Credentials stored with AES-256-GCM in `~/.cora/store.enc`.
- Secret material is local-only (`~/.cora/master.key`) with restricted file permissions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, test commands, and pull request expectations.

## Security disclosures

See [SECURITY.md](SECURITY.md) to report vulnerabilities privately.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
