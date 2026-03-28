import type { Connector } from "./types";

export const mysqlConnector: Connector = {
  type: "mysql",
  async execute({ source, query }) {
    const url = (source.url as string | undefined) ?? (source.connectionString as string | undefined);

    if (!url) {
      throw new Error(`Source ${source.id} (mysql) is missing \"url\".`);
    }

    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection(url);

    try {
      const [rows] = await connection.query(query);
      return rows;
    } finally {
      await connection.end();
    }
  },
};
