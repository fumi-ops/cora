import type { Connector } from "./types";

function queryDuckDb(
  connection: { all: (sql: string, callback: (error: Error | null, rows: unknown[]) => void) => void },
  sql: string,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows ?? []);
    });
  });
}

function closeDuckDb(
  db: { close: (callback: (error: Error | null) => void) => void },
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export const duckdbConnector: Connector = {
  type: "duckdb",
  async execute({ source, query }) {
    const file =
      (source.path as string | undefined) ??
      (source.file as string | undefined) ??
      (source.url as string | undefined) ??
      ":memory:";

    const duckdb = await import("duckdb");

    const db = new duckdb.Database(file);
    const connection = db.connect();

    try {
      return await queryDuckDb(connection, query);
    } finally {
      connection.close();
      await closeDuckDb(db);
    }
  },
};
