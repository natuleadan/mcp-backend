import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getClient } from '../db.js'

export function registerExecuteRlsSqlTool(server: McpServer) {
  server.tool(
    'execute_rls_sql',
    'Run a SELECT query impersonating a user role (applies RLS). Useful to test what a role can see.',
    z.object({
      sql: z.string().describe('SQL SELECT query'),
      role: z
        .enum(['authenticated', 'anon', 'service_role'])
        .describe('Supabase role to impersonate'),
      user_id: z.string().optional().describe('UUID of the user to set in JWT context'),
      params: z.array(z.unknown()).optional(),
    }).shape,
    async ({
      sql,
      role,
      user_id,
      params,
    }: {
      sql: string
      role: string
      user_id?: string
      params?: unknown[]
    }) => {
      try {
        if (!/^\s*SELECT/i.test(sql)) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ execute_rls_sql only allows SELECT queries',
              },
            ],
            isError: true,
          }
        }
        // Validate user_id format if provided (UUID)
        if (
          user_id &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)
        ) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Invalid UUID format for user_id',
              },
            ],
            isError: true,
          }
        }
        const client = await getClient()
        try {
          // role is safe (enum-validated by zod)
          await client.query(`SET LOCAL role = '${role}'`)
          if (user_id) {
            // user_id validated as UUID format above
            await client.query(`SET LOCAL request.jwt.claim.sub = '${user_id}'`)
          }
          const result = await client.query(sql, params ?? [])
          return {
            content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }],
          }
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
