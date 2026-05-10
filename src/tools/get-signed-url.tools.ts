import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'

export function registerGetSignedUrlTool(server: McpServer) {
  server.tool(
    'get_signed_url',
    'Generate a signed URL for a private bucket file',
    z.object({
      bucket: z.string().describe('Bucket name'),
      path: z.string().describe('File path in the bucket'),
      expires_in: z.coerce.number().int().default(3600).describe('Expiry in seconds'),
    }).shape,
    async ({
      bucket,
      path: filePath,
      expires_in,
    }: {
      bucket: string
      path: string
      expires_in: number
    }) => {
      try {
        const storage = getStorage()
        const signedUrl = await storage.getSignedUrl(bucket, filePath, expires_in)
        return {
          content: [{ type: 'text', text: signedUrl }],
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
