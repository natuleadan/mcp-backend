import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getClient, runQuery } from '../db.js'

export function registerExecuteSqlTool(server: McpServer) {
  server.tool(
    'execute_sql',
    'Run any SQL statement (INSERT, UPDATE, DELETE, SELECT, etc.) with full bypass of RLS. Use with care.',
    z.object({
      sql: z.string().describe('SQL statement to execute'),
      params: z.array(z.unknown()).optional().describe('Optional query parameters ($1, $2...)'),
    }).shape,
    async ({ sql, params }: { sql: string; params?: unknown[] }) => {
      try {
        // Detect SELECT at start (accounting for leading whitespace/comments)
        const isSelect = /^\s*SELECT/i.test(sql.replace(/^(\s*\/\*.*?\*\/\s*)*/, ''))
        if (isSelect) {
          const rows = await runQuery(sql, params)
          return {
            content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
          }
        }
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const result = await client.query(sql, params ?? [])
          await client.query('COMMIT')
          return {
            content: [{ type: 'text', text: `✅ OK — ${result.rowCount ?? 0} row(s) affected` }],
          }
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          await client.end()
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
