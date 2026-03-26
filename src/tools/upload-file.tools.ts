import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'
import { config } from '../config.js'
import fs from 'node:fs'
import path from 'node:path'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
}

export function registerUploadFileTool(server: McpServer) {
  server.tool(
    'upload_file',
    'Upload any local file to a Supabase storage bucket. local_path can be absolute (/Users/...) or relative to buckets/{bucket}/',
    z.object({
      bucket: z.string().describe('Bucket name'),
      local_path: z
        .string()
        .describe(
          'File path — absolute (/Users/leo/logo.svg) or relative to buckets/{bucket}/ (images/logo.svg)'
        ),
      storage_path: z
        .string()
        .describe("Destination path inside the bucket (e.g. 'branding/logo.svg')"),
      upsert: z.boolean().default(true),
    }).shape,
    async ({
      bucket,
      local_path,
      storage_path,
      upsert,
    }: {
      bucket: string
      local_path: string
      storage_path: string
      upsert: boolean
    }) => {
      try {
        const fullPath = path.isAbsolute(local_path)
          ? local_path
          : path.join(config.bucketsDir, bucket, local_path)
        if (!fs.existsSync(fullPath)) {
          return {
            content: [{ type: 'text', text: `❌ File not found: ${fullPath}` }],
            isError: true,
          }
        }
        const fileBuffer = fs.readFileSync(fullPath)
        const ext = path.extname(fullPath).toLowerCase()
        const contentType = MIME_MAP[ext] ?? 'application/octet-stream'
        const supabase = getSupabase()
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(storage_path, fileBuffer, { contentType, upsert })
        if (error) throw new Error(error.message)
        return {
          content: [{ type: 'text', text: `✅ Uploaded → ${bucket}/${data.path}` }],
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
