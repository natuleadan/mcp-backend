import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerQueryWithExplainTool(server: McpServer) {
  server.tool(
    'query_with_explain',
    'Run query with EXPLAIN ANALYZE for performance debugging',
    {
      sql: z.string().describe('SELECT query to analyze'),
      verbose: z.boolean().default(false).describe('Include ANALYZE, BUFFERS, VERBOSE'),
    },
    async ({ sql, verbose }: { sql: string; verbose: boolean }) => {
      try {
        if (!/^\s*SELECT/i.test(sql)) {
          return {
            content: [{ type: 'text', text: '❌ Only SELECT queries allowed for EXPLAIN' }],
            isError: true,
          }
        }

        const explainSql = `EXPLAIN ${verbose ? '(ANALYZE, BUFFERS, VERBOSE)' : '(ANALYZE)'} ${sql}`
        const result = await runQuery(explainSql, [])
        const planText = result.map((r: Record<string, unknown>) => r['QUERY PLAN']).join('\n')

        return {
          content: [{ type: 'text', text: planText }],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ EXPLAIN Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
