import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerListIcebergTablesTool(server: McpServer) {
  server.tool(
    'list_iceberg_tables',
    'List all foreign tables in the iceberg schema (mapped via FDW in Postgres)',
    z.object({}).shape,
    async () => {
      try {
        const rows = await runQuery(
          `SELECT foreign_table_name AS table_name
           FROM information_schema.foreign_tables
           WHERE foreign_table_schema = 'iceberg'
           ORDER BY foreign_table_name`
        )
        if (!rows.length) {
          return {
            content: [{ type: 'text', text: 'No iceberg foreign tables found' }],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: rows.map((r: Record<string, unknown>) => `iceberg.${r.table_name}`).join('\n'),
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
