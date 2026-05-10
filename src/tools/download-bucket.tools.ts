import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getStorage } from '../storage.js'
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
        const storage = getStorage()
        const results: string[] = []

        async function downloadFile(bkt: string, filePath: string) {
          try {
            const buffer = await storage.downloadFile(bkt, filePath)
            const localPath = path.join(config.bucketsDir, bkt, filePath)
            fs.mkdirSync(path.dirname(localPath), { recursive: true })
            fs.writeFileSync(localPath, buffer)
            results.push(`✅ ${bkt}/${filePath}`)
          } catch (err) {
            results.push(`❌ ${bkt}/${filePath}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        async function downloadFolder(bkt: string, folderPath: string) {
          try {
            const files = await storage.listFiles(bkt, folderPath, limit)
            for (const item of files) {
              const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name
              await downloadFile(bkt, itemPath)
            }
          } catch (err) {
            results.push(`❌ list ${bkt}/${folderPath}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        if (file && bucket) {
          await downloadFile(bucket, file)
        } else if (bucket) {
          await downloadFolder(bucket, folder ?? '')
        } else {
          const buckets = await storage.listBuckets()
          for (const b of buckets) {
            await downloadFolder(b.name, '')
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
