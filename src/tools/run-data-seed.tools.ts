import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { runSql } from '../db.js'

function collectSqlFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSqlFiles(full))
    else if (entry.name.endsWith('.sql')) files.push(full)
  }
  return files.sort()
}

async function runDir(dir: string, label: string): Promise<string> {
  const files = collectSqlFiles(dir)
  const results: string[] = []
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8')
    await runSql(sql)
    results.push(path.relative(dir, file))
  }
  return `✅ ${label}: ${results.length} files executed.\n${results.join('\n')}`
}

export function registerRunDataSeedTool(server: McpServer) {
  server.tool(
    'run_data_seed',
    'Runs all SQL files in data/ (03-data.ee equivalent with real users, products, courses)',
    z.object({}).shape,
    async () => {
      try {
        const result = await runDir(config.dataDir, 'data seed')
        return {
          content: [{ type: 'text', text: result }],
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
