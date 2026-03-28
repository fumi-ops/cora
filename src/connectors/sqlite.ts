import type { Connector } from "./types";

export const sqliteConnector: Connector = {
  type: "sqlite",
  async execute({ source, query }) {
    const dbPath = (source.path as string | undefined) ?? (source.url as string | undefined);
    if (!dbPath) {
      throw new Error(`Source ${source.id} (sqlite) is missing \"path\".`);
    }

    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const statement = db.prepare(query);
      return statement.all();
    } finally {
      db.close();
    }
  },
};
