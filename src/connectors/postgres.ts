import type { Connector } from "./types";

export const postgresConnector: Connector = {
  type: "postgres",
  async execute({ source, query }) {
    const connectionString =
      (source.url as string | undefined) ?? (source.connectionString as string | undefined);

    if (!connectionString) {
      throw new Error(`Source ${source.id} (postgres) is missing \"url\".`);
    }

    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString });

    try {
      const result = await pool.query(query);
      return result.rows;
    } finally {
      await pool.end();
    }
  },
};
