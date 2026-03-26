import { z } from 'zod'
import { getSupabase } from '../supabase.js'

export const rpcTools = [
  {
    name: 'call_rpc',
    description:
      'Call a Supabase PostgreSQL function (RPC) via the REST API. Uses service_role — bypasses RLS.',
    inputSchema: z.object({
      fn: z.string().describe("Function name (e.g. 'validate_api_key')"),
      args: z
        .union([z.record(z.unknown()), z.string()])
        .optional()
        .describe('Named arguments as JSON object or JSON string'),
    }),
    handler: async ({ fn, args }: { fn: string; args?: Record<string, unknown> | string }) => {
      const supabase = getSupabase()
      const resolvedArgs = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
      const { data, error } = await supabase.rpc(fn, resolvedArgs)
      if (error) throw new Error(error.message)
      return JSON.stringify(data, null, 2)
    },
  },
]
