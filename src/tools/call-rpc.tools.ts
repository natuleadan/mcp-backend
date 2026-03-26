import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'

export function registerCallRpcTool(server: McpServer) {
  server.tool(
    'call_rpc',
    'Call a Supabase PostgreSQL function (RPC) via the REST API. Uses service_role — bypasses RLS.',
    {
      fn: z.string().describe("Function name (e.g. 'validate_api_key')"),
      args: z
        .union([z.record(z.unknown()), z.string()])
        .optional()
        .describe('Named arguments as JSON object or JSON string'),
    },
    async ({ fn, args }: { fn: string; args?: Record<string, unknown> | string }) => {
      try {
        const supabase = getSupabase()
        const resolvedArgs = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
        const { data, error } = await supabase.rpc(fn, resolvedArgs)
        if (error) throw new Error(error.message)
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
