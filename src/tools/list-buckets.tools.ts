import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'

export function registerListBucketsTool(server: McpServer) {
  server.tool(
    'list_buckets',
    'List all Supabase storage buckets with their visibility',
    z.object({}).shape,
    async () => {
      try {
        const storage = getStorage()
        const data = await storage.listBuckets()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
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
