import { z } from "zod";
import { runQuery } from "../db.js";
import { config } from "../config.js";

async function getIcebergCatalog() {
  if (!config.catalogUri || !config.icebergToken) {
    throw new Error("Iceberg not configured — set CATALOG_URI and ICEBERG_TOKEN (service_role JWT of the iceberg Supabase project) in .env");
  }
  const { IcebergRestCatalog } = await import("iceberg-js");
  return new IcebergRestCatalog({
    baseUrl: config.catalogUri,
    catalogName: config.icebergWarehouse,
    auth: { type: "bearer" as const, token: config.icebergToken },
  });
}

export const icebergTools = [
  {
    name: "list_iceberg_tables",
    description: "List all foreign tables in the iceberg schema (mapped via FDW in Postgres)",
    inputSchema: z.object({}),
    handler: async () => {
      const rows = await runQuery(
        `SELECT foreign_table_name AS table_name
         FROM information_schema.foreign_tables
         WHERE foreign_table_schema = 'iceberg'
         ORDER BY foreign_table_name`
      );
      if (!rows.length) return "No iceberg foreign tables found";
      return rows.map((r: Record<string, unknown>) => `iceberg.${r.table_name}`).join("\n");
    },
  },

  {
    name: "query_iceberg",
    description: "SELECT from an Iceberg foreign table via Postgres FDW (e.g. 'iceberg.aud_analytics_lake')",
    inputSchema: z.object({
      table: z.string().describe("Full table name including schema (e.g. 'iceberg.aud_analytics_lake')"),
      where: z.string().optional().describe("Optional WHERE clause"),
      order_by: z.string().optional().describe("Optional ORDER BY clause"),
      limit: z.coerce.number().int().min(1).max(1000).default(50),
    }),
    handler: async ({ table, where, order_by, limit }: { table: string; where?: string; order_by?: string; limit: number }) => {
      if (!/^[a-z_]+\.[a-z_]+$/i.test(table)) {
        return "❌ Invalid table name. Use format: schema.table_name";
      }
      let sql = `SELECT * FROM ${table}`;
      if (where) sql += ` WHERE ${where}`;
      if (order_by) sql += ` ORDER BY ${order_by}`;
      sql += ` LIMIT ${limit}`;
      const rows = await runQuery(sql, [], 30_000);
      return JSON.stringify(rows, null, 2);
    },
  },

  {
    name: "list_iceberg_catalog_tables",
    description: "List tables directly from the Iceberg REST Catalog (requires CATALOG_URI + AWS credentials)",
    inputSchema: z.object({
      namespace: z.string().optional().describe("Namespace to list (defaults to ICEBERG_NAMESPACE from config)"),
    }),
    handler: async ({ namespace }: { namespace?: string }) => {
      const catalog = await getIcebergCatalog();
      if (namespace) {
        const tables = await catalog.listTables({ namespace: [namespace] });
        return JSON.stringify(tables, null, 2);
      }
      // List all namespaces + their tables
      const namespaces = await catalog.listNamespaces();
      const result: Record<string, unknown[]> = {};
      for (const ns of namespaces) {
        const nsPath = Array.isArray(ns.namespace) ? ns.namespace : [ns.namespace];
        const tables = await catalog.listTables({ namespace: nsPath });
        result[nsPath.join(".")] = tables.map((t: { name: string }) => t.name);
      }
      return JSON.stringify(result, null, 2);
    },
  },
];
