# Community Connectors

Cora discovers local connector packages from `node_modules` using the prefix `cora-connector-*`.

Supported package names:

- `cora-connector-foo`
- `@scope/cora-connector-foo`

If your `cora.config.yaml` source has `type: foo`, Cora will try to load connector `foo` from discovered packages.

## Supported module exports

A package can export either an internal connector shape or the community shape.

### Internal shape

```ts
export interface Connector {
  type: string;
  namedQueries?: Record<string, (source: SourceConfig) => Promise<unknown>>;
  execute(execution: { source: SourceConfig; query: string }): Promise<unknown>;
}
```

Export forms accepted:

- `export default connector`
- `export const connector = ...`
- `export const connectors = [ ... ]`

### Community shape

```ts
export interface CoraConnector {
  id: string;
  fetch(query: string, auth: Record<string, string>): Promise<unknown>;
  namedQueries?: Record<string, () => Promise<unknown>>;
}
```

For the community shape, Cora passes all string-valued source fields except `id`, `type`, and `refresh` into `auth`.
