import { z } from "zod";
import { runQuery } from "../db.js";

export const queryTools = [
  {
    name: "query_db",
    description: "Run a raw SQL SELECT query against the database. READ ONLY - for inspection/verification.",
    inputSchema: z.object({
      sql: z.string().describe("SQL SELECT query to run"),
      params: z.array(z.unknown()).optional().describe("Query parameters ($1, $2...)"),
    }),
    handler: async ({ sql, params }: { sql: string; params?: unknown[] }) => {
      if (!/^\s*SELECT/i.test(sql)) {
        return "❌ Only SELECT queries allowed in query_db. Use seed tools for writes.";
      }
      const rows = await runQuery(sql, params);
      return JSON.stringify(rows, null, 2);
    },
  },
  {
    name: "list_tables",
    description: "List all tables in the public schema",
    inputSchema: z.object({}),
    handler: async () => {
      const rows = await runQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      return rows.map((r: Record<string, unknown>) => r.table_name).join("\n");
    },
  },
];
