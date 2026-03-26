import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerIndexInfoTool(server: McpServer) {
  server.tool(
    'index_info',
    'List indexes with size, scan count, and usage stats',
    {
      table: z.string().optional(),
    },
    async ({ table }: { table?: string }) => {
      try {
        let sql = `
          SELECT
            schemaname,
            tablename,
            indexname,
            pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
            idx_scan as scan_count
          FROM pg_indexes
          LEFT JOIN pg_stat_user_indexes ON indexrelname = indexname
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        `

        const params: unknown[] = []
        if (table) {
          sql += ' AND tablename = $1'
          params.push(table)
        }

        sql += ' ORDER BY pg_relation_size(indexrelid) DESC'

        const rows = await runQuery(sql, params)

        if (!rows.length) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ No indexes found${table ? ` for table ${table}` : ''}`,
              },
            ],
          }
        }

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
