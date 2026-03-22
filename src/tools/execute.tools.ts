import { z } from "zod";
import { getClient, runQuery } from "../db.js";

export const executeTools = [
  {
    name: "execute_sql",
    description: "Run any SQL statement (INSERT, UPDATE, DELETE, SELECT, etc.) with full bypass of RLS. Use with care.",
    inputSchema: z.object({
      sql: z.string().describe("SQL statement to execute"),
      params: z.array(z.unknown()).optional().describe("Optional query parameters ($1, $2...)"),
    }),
    handler: async ({ sql, params }: { sql: string; params?: unknown[] }) => {
      const isSelect = /^\s*SELECT/i.test(sql);
      if (isSelect) {
        const rows = await runQuery(sql, params);
        return JSON.stringify(rows, null, 2);
      }
      const client = await getClient();
      try {
        await client.query("BEGIN");
        const result = await client.query(sql, params ?? []);
        await client.query("COMMIT");
        return `✅ OK — ${result.rowCount ?? 0} row(s) affected`;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        await client.end();
      }
    },
  },

  {
    name: "execute_rls_sql",
    description: "Run a SELECT query impersonating a user role (applies RLS). Useful to test what a role can see.",
    inputSchema: z.object({
      sql: z.string().describe("SQL SELECT query"),
      role: z.enum(["authenticated", "anon", "service_role"]).describe("Supabase role to impersonate"),
      user_id: z.string().optional().describe("UUID of the user to set in JWT context"),
      params: z.array(z.unknown()).optional(),
    }),
    handler: async ({ sql, role, user_id, params }: { sql: string; role: string; user_id?: string; params?: unknown[] }) => {
      if (!/^\s*SELECT/i.test(sql)) {
        return "❌ execute_rls_sql only allows SELECT queries";
      }
      const client = await getClient();
      try {
        await client.query(`SET LOCAL role = '${role}'`);
        if (user_id) {
          await client.query(`SET LOCAL request.jwt.claim.sub = '${user_id}'`);
        }
        const result = await client.query(sql, params ?? []);
        return JSON.stringify(result.rows, null, 2);
      } finally {
        await client.end();
      }
    },
  },
];
