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
  '.parquet': 'application/octet-stream',
}

export function registerBulkUploadFilesTool(server: McpServer) {
  server.tool(
    'bulk_upload_files',
    'Upload multiple local files to Supabase storage with progress tracking',
    {
      bucket: z.string(),
      files: z.array(
        z.object({
          local_path: z.string(),
          storage_path: z.string(),
        })
      ),
      upsert: z.boolean().default(true),
    },
    async ({
      bucket,
      files,
      upsert,
    }: {
      bucket: string
      files: Array<{ local_path: string; storage_path: string }>
      upsert: boolean
    }) => {
      try {
        const supabase = getSupabase()
        const results: { file: string; status: string }[] = []

        for (const { local_path, storage_path } of files) {
          const fullPath = path.isAbsolute(local_path)
            ? local_path
            : path.join(config.bucketsDir, bucket, local_path)

          if (!fs.existsSync(fullPath)) {
            results.push({ file: storage_path, status: `❌ Not found` })
            continue
          }

          try {
            const fileBuffer = fs.readFileSync(fullPath)
            const ext = path.extname(fullPath).toLowerCase()
            const contentType = MIME_MAP[ext] ?? 'application/octet-stream'

            const { error } = await supabase.storage
              .from(bucket)
              .upload(storage_path, fileBuffer, { contentType, upsert })

            if (error) {
              results.push({ file: storage_path, status: `❌ ${error.message}` })
            } else {
              results.push({ file: storage_path, status: '✅ Uploaded' })
            }
          } catch (err) {
            results.push({
              file: storage_path,
              status: `❌ ${err instanceof Error ? err.message : String(err)}`,
            })
          }
        }

        const succeeded = results.filter((r) => r.status.startsWith('✅')).length
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary: `${succeeded}/${files.length} files uploaded`,
                  results,
                },
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
