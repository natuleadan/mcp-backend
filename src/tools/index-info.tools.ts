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
            pi.schemaname,
            pi.tablename,
            pi.indexname,
            pg_size_pretty(pg_relation_size(psi.indexrelid)) as index_size,
            COALESCE(psi.idx_scan, 0) as scan_count
          FROM pg_indexes pi
          LEFT JOIN pg_stat_user_indexes psi ON psi.indexrelname = pi.indexname
          WHERE pi.schemaname NOT IN ('pg_catalog', 'information_schema')
        `

        const params: unknown[] = []
        if (table) {
          sql += ' AND pi.tablename = $1'
          params.push(table)
        }

        sql += ' ORDER BY pg_relation_size(psi.indexrelid) DESC NULLS LAST'

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
