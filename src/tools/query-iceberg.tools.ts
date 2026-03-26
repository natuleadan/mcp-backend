import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerQueryIcebergTool(server: McpServer) {
  server.tool(
    'query_iceberg',
    "SELECT from an Iceberg foreign table via Postgres FDW (e.g. 'iceberg.aud_analytics_lake')",
    z.object({
      table: z
        .string()
        .describe("Full table name including schema (e.g. 'iceberg.aud_analytics_lake')"),
      where: z.string().optional().describe('Optional WHERE clause (uses parameterized query)'),
      order_by: z
        .string()
        .optional()
        .describe('Optional ORDER BY clause (column.direction format)'),
      limit: z.coerce.number().int().min(1).max(1000).default(50),
    }).shape,
    async ({
      table,
      where,
      order_by,
      limit,
    }: {
      table: string
      where?: string
      order_by?: string
      limit: number
    }) => {
      try {
        if (!/^[a-z_]+\.[a-z_]+$/i.test(table)) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Invalid table name. Use format: schema.table_name',
              },
            ],
            isError: true,
          }
        }
        // Validate WHERE clause - no SQL keywords except AND/OR/NOT
        if (
          where &&
          /;\s*|--\s*|\/\*|\*\/|(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE)\s/i.test(where)
        ) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ WHERE clause contains invalid SQL keywords or comments',
              },
            ],
            isError: true,
          }
        }
        // Validate ORDER BY - only allow column_name ASC/DESC pattern
        if (order_by && !/^[a-z_][a-z_0-9]*\s+(asc|desc)$/i.test(order_by.trim())) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ ORDER BY must be "column_name ASC/DESC" format',
              },
            ],
            isError: true,
          }
        }
        let sql = `SELECT * FROM ${table}`
        if (where) sql += ` WHERE ${where}`
        if (order_by) sql += ` ORDER BY ${order_by}`
        sql += ` LIMIT ${limit}`
        const rows = await runQuery(sql, [], 30_000)
        return {
          content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
