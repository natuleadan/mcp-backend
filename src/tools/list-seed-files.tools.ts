import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

function collectSqlFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSqlFiles(full))
    else if (entry.name.endsWith('.sql')) files.push(full)
  }
  return files.sort()
}

export function registerListSeedFilesTool(server: McpServer) {
  server.tool(
    'list_seed_files',
    'Lists all SQL files available in base/ and data/',
    z.object({
      target: z.enum(['base', 'data', 'all']).default('all'),
    }).shape,
    async ({ target }: { target: string }) => {
      try {
        const lines: string[] = []
        if (target !== 'data') {
          const files = collectSqlFiles(config.baseDir)
          lines.push('=== base/ ===')
          lines.push(...files.map((f) => path.relative(config.baseDir, f)))
        }
        if (target !== 'base') {
          const files = collectSqlFiles(config.dataDir)
          lines.push('=== data/ ===')
          lines.push(...files.map((f) => path.relative(config.dataDir, f)))
        }
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
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
