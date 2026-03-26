import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerListTablesTool(server: McpServer) {
  server.tool(
    'list_tables',
    'List all tables in the public schema',
    z.object({}).shape,
    async () => {
      try {
        const rows = await runQuery(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        const result = rows.map((r: Record<string, unknown>) => r.table_name).join('\n')
        return {
          content: [{ type: 'text', text: result }],
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
