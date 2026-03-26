import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'

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
        const supabase = getSupabase()
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expires_in)
        if (error) throw new Error(error.message)
        return {
          content: [{ type: 'text', text: data.signedUrl }],
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
