import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'

export function registerManageBucketTool(server: McpServer) {
  server.tool(
    'manage_bucket',
    'Create, update, delete or empty a storage bucket. Works with Supabase Storage (supabase mode) or S3-compatible (postgres mode).',
    {
      action: z.enum(['create', 'delete', 'empty', 'update']).describe('Operation to perform'),
      name: z.string().describe('Bucket name'),
      public: z.boolean().optional().describe('Set bucket as public (for create/update)'),
      allowed_mime_types: z.array(z.string()).optional().describe('Allowed MIME types (Supabase only, for create/update)'),
      file_size_limit: z.coerce.number().int().optional().describe('Max file size in bytes (Supabase only, for create/update)'),
    },
    async ({
      action,
      name,
      public: isPublic,
      allowed_mime_types,
      file_size_limit,
    }: {
      action: string
      name: string
      public?: boolean
      allowed_mime_types?: string[]
      file_size_limit?: number
    }) => {
      try {
        const storage = getStorage()

        switch (action) {
          case 'create':
            await storage.createBucket(name, isPublic ?? false, allowed_mime_types, file_size_limit)
            return { content: [{ type: 'text', text: `✅ Bucket created: ${name}` }] }
          case 'delete':
            await storage.deleteBucket(name)
            return { content: [{ type: 'text', text: `✅ Bucket deleted: ${name}` }] }
          case 'empty':
            await storage.emptyBucket(name)
            return { content: [{ type: 'text', text: `✅ Bucket emptied: ${name}` }] }
          case 'update':
            await storage.updateBucket(name, isPublic ?? false, allowed_mime_types, file_size_limit)
            return { content: [{ type: 'text', text: `✅ Bucket updated: ${name}` }] }
          default:
            return { content: [{ type: 'text', text: `❌ Unknown action: ${action}` }], isError: true }
        }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        }
      }
    }
  )
}
