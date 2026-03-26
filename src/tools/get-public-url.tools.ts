import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'

export function registerGetPublicUrlTool(server: McpServer) {
  server.tool(
    'get_public_url',
    'Get the public URL for a file in a public bucket',
    z.object({
      bucket: z.string().describe('Bucket name (must be public)'),
      path: z.string().describe('File path in the bucket'),
    }).shape,
    async ({ bucket, path: filePath }: { bucket: string; path: string }) => {
      try {
        const supabase = getSupabase()
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
        return {
          content: [{ type: 'text', text: data.publicUrl }],
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
