import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerDatabaseStatsTool(server: McpServer) {
  server.tool(
    'database_stats',
    'Database statistics: table sizes, row counts, growth metrics',
    {
      top_n: z.coerce.number().int().default(10),
    },
    async ({ top_n }: { top_n: number }) => {
      try {
        const rows = await runQuery(
          `SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
            pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
          FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
          LIMIT $1`,
          [top_n]
        )

        if (!rows.length) {
          return {
            content: [{ type: 'text', text: '❌ No user tables found' }],
          }
        }

        const dbSize = await runQuery(
          `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  database_total_size: (dbSize[0] as Record<string, unknown>)?.size,
                  largest_tables: rows,
                },
                null,
                2
              ),
            },
          ],
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
