import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getClient, runQuery } from '../db.js'

export function registerExecuteSqlFileTool(server: McpServer) {
  server.tool(
    'execute_sql_file',
    'Execute SQL file content (PL/pgSQL blocks, multi-statement scripts). Pass raw SQL from file as string.',
    z.object({
      sql: z.string().describe('Raw SQL file content (entire file as string)'),
      filename: z
        .string()
        .optional()
        .describe('Optional filename for logging/reference (e.g., "115.1.nav.es.sql")'),
    }).shape,
    async ({ sql, filename }: { sql: string; filename?: string }) => {
      try {
        const fileLabel = filename ? ` [${filename}]` : ''

        // Detect if it's a SELECT-only script (no writes)
        const isSelectOnly =
          /^\s*(SELECT|WITH)/i.test(sql.trim()) &&
          !/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/im.test(sql)

        if (isSelectOnly) {
          const rows = await runQuery(sql, [])
          return {
            content: [
              { type: 'text', text: `✅ SELECT${fileLabel}\n${JSON.stringify(rows, null, 2)}` },
            ],
          }
        }

        // Execute write operations (PL/pgSQL blocks, DDL, DML)
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const result = await client.query(sql, [])
          await client.query('COMMIT')
          return {
            content: [
              { type: 'text', text: `✅ OK${fileLabel} — ${result.rowCount ?? 0} row(s) affected` },
            ],
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
              text: `❌ Error${filename ? ` [${filename}]` : ''}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
