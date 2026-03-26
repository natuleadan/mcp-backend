import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerValidateSqlTool(server: McpServer) {
  server.tool(
    'validate_sql',
    'Parse SQL without executing - catch syntax errors early',
    {
      sql: z.string().describe('SQL statement to validate'),
    },
    async ({ sql }: { sql: string }) => {
      try {
        await runQuery(`EXPLAIN (FORMAT JSON) ${sql.replace(/;$/, '')}`, [])
        return {
          content: [{ type: 'text', text: '✅ SQL is valid' }],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ SQL Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
