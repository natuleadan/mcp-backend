import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'

export function registerDeleteFileTool(server: McpServer) {
  server.tool(
    'delete_file',
    'Delete a file from a Supabase storage bucket',
    z.object({
      bucket: z.string().describe('Bucket name'),
      path: z.string().describe('File path in the bucket'),
    }).shape,
    async ({ bucket, path: filePath }: { bucket: string; path: string }) => {
      try {
        const supabase = getSupabase()
        const { error } = await supabase.storage.from(bucket).remove([filePath])
        if (error) throw new Error(error.message)
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
