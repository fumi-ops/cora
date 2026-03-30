# Cora Docs

This folder contains the Astro-based documentation site for Cora.

## Local development

```bash
bun install
bun run dev:docs
```

## Build

```bash
bun run build:docs
```

## Content

- `src/content/docs/` holds the published documentation pages
- `src/config/` controls the theme, navigation, and footer links
- `src/components/override-components/` customizes the Dockit Astro theme
