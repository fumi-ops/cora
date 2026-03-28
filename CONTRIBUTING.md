# Contributing to Cora

Thanks for contributing. This document covers the default workflow for code changes.

## Prerequisites

- Bun `>=1.3.0`
- Node.js `>=22.13.0`
- Git

## Local setup

```bash
bun install
```

Run the CLI locally:

```bash
bun run src/cli.ts --help
```

Run the dashboard server locally:

```bash
bun run src/cli.ts serve
```

## Validation checklist

Before opening a pull request, run:

```bash
bun run typecheck
bun run lint
bun run test
bun run check:embedded-ui
```

Or run everything in one command:

```bash
bun run ci
```

## Pull request expectations

- Keep changes focused and scoped to one concern.
- Add or update tests for behavior changes.
- Update docs when commands, configuration, or developer workflow changes.
- Use clear commit messages and a clear PR description.

## Development notes

- Avoid committing secrets or `.env` values.
- Do not edit generated assets manually when a source file exists.
- If you change command behavior, update `README.md` command docs.
