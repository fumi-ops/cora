---
title: Workspace files
description: Learn which files Cora creates and how each one participates in the local workflow.
---

## Workspace layout

Cora keeps the working set small and file-driven. A typical workspace includes:

```text
dashboard.json
cora.config.yaml
cora.cache.json
.env
CORA_AGENT_INSTRUCTIONS.md
```

## What each file does

| File | Purpose |
| --- | --- |
| `dashboard.json` | The rendered dashboard state. Agents can update individual widget values here. |
| `cora.config.yaml` | Source bindings, refresh behavior, and dashboard wiring. |
| `cora.cache.json` | Cached source data so refreshes stay local and predictable. |
| `.env` | Optional project credentials and runtime secrets. |
| `CORA_AGENT_INSTRUCTIONS.md` | The contract that tells an agent how to update the workspace safely. |

## Credential resolution

Cora resolves credentials in this order:

1. Shell environment variable
2. Project `.env`
3. Encrypted store at `~/.cora/store.enc`

That ordering keeps the common cases simple while still allowing a secure fallback.

## When to use this page

Use this page when you want to:

- understand where data lives
- decide which file a change belongs in
- explain the workspace contract to another contributor or agent

## Related docs

- [Quickstart](/getting-started/introduction/quickstart/)
- [Configuration format](/reference/configuration/)
- [Connectors](/reference/connectors/)
