# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Future changes will be listed here.

## [1.0.0] - 2026-03-29

### Added
- Initial release of Cora, an AI agent-ready local-first dashboard runtime.
- CLI commands for `init`, `serve`, `fetch`, `validate`, `export`, `sources list`, and `config`.
- Built-in connectors for Postgres, MySQL, SQLite, DuckDB, HTTP, Stripe, Plausible, and GitHub.
- Community connector discovery via local `node_modules` packages prefixed with `cora-connector-*`.
- Embedded local web UI for rendering dashboard values and sending widget updates.
- Encrypted local credential storage and project-level credential resolution.
- Test, lint, and CI scaffolding for the CLI and UI workspace.
