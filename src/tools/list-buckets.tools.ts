import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'

export function registerListBucketsTool(server: McpServer) {
  server.tool(
    'list_buckets',
    'List all Supabase storage buckets with their visibility',
    z.object({}).shape,
    async () => {
      try {
        const supabase = getSupabase()
        const { data, error } = await supabase.storage.listBuckets()
        if (error) throw new Error(error.message)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                data.map((b: { id: string; name: string; public: boolean }) => ({
                  id: b.id,
                  name: b.name,
                  public: b.public,
                })),
                null,
                2
              ),
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
