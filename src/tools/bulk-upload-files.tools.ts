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
    'Upload multiple local files to Supabase storage with optional filtering by file type. Can upload individual files or an entire folder with selective file extensions.',
    {
      bucket: z.string().describe('Supabase bucket name'),
      files: z
        .array(
          z.object({
            local_path: z.string(),
            storage_path: z.string(),
          })
        )
        .optional()
        .describe('Array of files: [{local_path, storage_path}, ...]. Either files or folder_path required.'),
      folder_path: z
        .string()
        .optional()
        .describe('Local folder path to upload (absolute or relative to buckets/{bucket}). Discovers files recursively.'),
      storage_prefix: z
        .string()
        .optional()
        .describe('Optional prefix for storage paths when uploading from folder (e.g., "products/" prepends to all files)'),
      ignore_extensions: z
        .array(z.string())
        .optional()
        .describe('File extensions to skip (e.g., [".sql", ".tmp", ".md"]). Case-insensitive.'),
      upsert: z.boolean().default(true).describe('Overwrite files if they exist'),
    },
    async ({
      bucket,
      files,
      folder_path,
      storage_prefix = '',
      ignore_extensions = [],
      upsert,
    }: {
      bucket: string
      files?: Array<{ local_path: string; storage_path: string }>
      folder_path?: string
      storage_prefix?: string
      ignore_extensions?: string[]
      upsert: boolean
    }) => {
      try {
        const supabase = getSupabase()
        const results: { file: string; status: string }[] = []
        const normalizedIgnoreExt = ignore_extensions.map((ext) =>
          ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
        )

        // Helper: check if file should be skipped
        function shouldIgnore(filePath: string): boolean {
          const ext = path.extname(filePath).toLowerCase()
          return normalizedIgnoreExt.includes(ext)
        }

        // Helper: upload single file
        async function uploadFile(fullLocalPath: string, storagePath: string) {
          if (!fs.existsSync(fullLocalPath)) {
            results.push({ file: storagePath, status: `❌ Not found` })
            return
          }

          try {
            const fileBuffer = fs.readFileSync(fullLocalPath)
            const ext = path.extname(fullLocalPath).toLowerCase()
            const contentType = MIME_MAP[ext] ?? 'application/octet-stream'

            const { error } = await supabase.storage
              .from(bucket)
              .upload(storagePath, fileBuffer, { contentType, upsert })

            if (error) {
              results.push({ file: storagePath, status: `❌ ${error.message}` })
            } else {
              results.push({ file: storagePath, status: '✅ Uploaded' })
            }
          } catch (err) {
            results.push({
              file: storagePath,
              status: `❌ ${err instanceof Error ? err.message : String(err)}`,
            })
          }
        }

        // Helper: recursively discover and upload files from folder
        async function uploadFolder(folderPath: string, basePrefix: string) {
          const entries = fs.readdirSync(folderPath, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name)

            if (entry.isDirectory()) {
              // Recurse into subdirectories
              await uploadFolder(fullPath, `${basePrefix}${entry.name}/`)
            } else if (entry.isFile()) {
              // Check if file should be ignored
              if (shouldIgnore(entry.name)) {
                results.push({ file: `${basePrefix}${entry.name}`, status: `⏭️  Skipped (ignored extension)` })
                continue
              }

              const storagePath = `${basePrefix}${entry.name}`
              await uploadFile(fullPath, storagePath)
            }
          }
        }

        // Route 1: Upload specific files array
        if (files && files.length > 0) {
          for (const { local_path, storage_path } of files) {
            const fullPath = path.isAbsolute(local_path)
              ? local_path
              : path.join(config.bucketsDir, bucket, local_path)
            await uploadFile(fullPath, storage_path)
          }
        }
        // Route 2: Upload entire folder
        else if (folder_path) {
          const fullFolderPath = path.isAbsolute(folder_path)
            ? folder_path
            : path.join(config.bucketsDir, bucket, folder_path)

          if (!fs.existsSync(fullFolderPath)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Folder not found: ${fullFolderPath}`,
                },
              ],
              isError: true,
            }
          }

          if (!fs.statSync(fullFolderPath).isDirectory()) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Path is not a directory: ${fullFolderPath}`,
                },
              ],
              isError: true,
            }
          }

          await uploadFolder(fullFolderPath, storage_prefix)
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Must provide either 'files' array or 'folder_path'`,
              },
            ],
            isError: true,
          }
        }

        const succeeded = results.filter((r) => r.status.startsWith('✅')).length
        const skipped = results.filter((r) => r.status.startsWith('⏭️')).length
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary: `${succeeded} uploaded, ${skipped} skipped, ${results.length - succeeded - skipped} failed`,
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
