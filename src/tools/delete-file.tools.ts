import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'

export function registerDeleteFileTool(server: McpServer) {
  server.tool(
    'delete_file',
    'Delete a file from a storage bucket',
    z.object({
      bucket: z.string().describe('Bucket name'),
      path: z.string().describe('File path in the bucket'),
    }).shape,
    async ({ bucket, path: filePath }: { bucket: string; path: string }) => {
      try {
        const storage = getStorage()
        await storage.deleteFile(bucket, filePath)
        return {
          content: [{ type: 'text', text: `✅ Deleted: ${bucket}/${filePath}` }],
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
