import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerActiveQueriesTool(server: McpServer) {
  server.tool(
    'active_queries',
    'List active/long-running queries with details (duration, memory, locks)',
    {
      min_duration_ms: z.coerce.number().int().default(1000),
    },
    async ({ min_duration_ms }: { min_duration_ms: number }) => {
      try {
        const rows = await runQuery(
          `SELECT
            pid,
            usename,
            application_name,
            state,
            query,
            EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms
          FROM pg_stat_activity
          WHERE query NOT ILIKE 'pg_stat_activity%'
            AND EXTRACT(EPOCH FROM (now() - query_start)) * 1000 > $1
          ORDER BY query_start DESC`,
          [min_duration_ms]
        )

        if (!rows.length) {
          return {
            content: [
              { type: 'text', text: `✨ No queries running longer than ${min_duration_ms}ms` },
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
