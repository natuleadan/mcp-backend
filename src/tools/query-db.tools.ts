import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerQueryDbTool(server: McpServer) {
  server.tool(
    'query_db',
    'Run a raw SQL SELECT query against the database. READ ONLY - for inspection/verification.',
    z.object({
      sql: z.string().describe('SQL SELECT query to run'),
      params: z.array(z.unknown()).optional().describe('Query parameters ($1, $2...)'),
    }).shape,
    async ({ sql, params }: { sql: string; params?: unknown[] }) => {
      try {
        if (!/^\s*SELECT/i.test(sql)) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Only SELECT queries allowed in query_db. Use seed tools for writes.',
              },
            ],
            isError: true,
          }
        }
        const rows = await runQuery(sql, params)
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
