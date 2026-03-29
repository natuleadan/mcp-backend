import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'
import { config } from '../config.js'
import fs from 'node:fs'
import path from 'node:path'

export function registerDownloadBucketTool(server: McpServer) {
  server.tool(
    'download_bucket',
    'Download files from Supabase storage to local buckets/ folder. Can download all buckets, one bucket, a specific folder, or a single file.',
    z.object({
      bucket: z.string().optional().describe('Bucket to download — omit to download ALL buckets'),
      folder: z
        .string()
        .optional()
        .describe("Folder path to download (e.g. 'branding/logos') — requires bucket"),
      file: z
        .string()
        .optional()
        .describe("Single file path to download (e.g. 'branding/logo.svg') — requires bucket"),
      limit: z.coerce.number().int().min(1).max(1000).default(200),
    }).shape,
    async ({
      bucket,
      folder,
      file,
      limit,
    }: {
      bucket?: string
      folder?: string
      file?: string
      limit: number
    }) => {
      try {
        const supabase = getSupabase()
        const results: string[] = []

        async function downloadFile(bkt: string, filePath: string) {
          const { data, error } = await supabase.storage.from(bkt).download(filePath)
          if (error) {
            results.push(`❌ ${bkt}/${filePath}: ${error.message}`)
            return
          }
          const localPath = path.join(config.bucketsDir, bkt, filePath)
          fs.mkdirSync(path.dirname(localPath), { recursive: true })
          const buffer = Buffer.from(await data.arrayBuffer())
          fs.writeFileSync(localPath, buffer)
          results.push(`✅ ${bkt}/${filePath}`)
        }

        async function downloadFolder(bkt: string, folderPath: string) {
          const { data, error } = await supabase.storage.from(bkt).list(folderPath, { limit })
          if (error) {
            results.push(`❌ list ${bkt}/${folderPath}: ${error.message}`)
            return
          }
          for (const item of data ?? []) {
            const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name
            if (item.id === null) {
              await downloadFolder(bkt, itemPath) // it's a folder
            } else {
              await downloadFile(bkt, itemPath)
            }
          }
        }

        if (file && bucket) {
          await downloadFile(bucket, file)
        } else if (bucket) {
          await downloadFolder(bucket, folder ?? '')
        } else {
          const { data: buckets, error } = await supabase.storage.listBuckets()
          if (error) {
            return {
              content: [{ type: 'text', text: `❌ ${error.message}` }],
              isError: true,
            }
          }
          for (const b of buckets ?? []) {
            await downloadFolder(b.id, '')
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Download complete (${results.length} files):\n${results.join('\n')}`,
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
