import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'

export function registerListFilesTool(server: McpServer) {
  server.tool(
    'list_files',
    'List files in a bucket folder',
    z.object({
      bucket: z.string().describe('Bucket name'),
      folder: z.string().optional().describe('Folder path (empty = root)'),
      limit: z.coerce.number().int().min(1).max(500).default(50),
    }).shape,
    async ({ bucket, folder, limit }: { bucket: string; folder?: string; limit: number }) => {
      try {
        const storage = getStorage()
        const data = await storage.listFiles(bucket, folder, limit)
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
