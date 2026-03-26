import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerColumnStatsTool(server: McpServer) {
  server.tool(
    'column_stats',
    'Get column statistics: cardinality, NULL count, data distribution',
    {
      table: z.string().describe("Table name (e.g. 'users')"),
      column: z.string().optional().describe('Specific column (omit for all)'),
      limit: z.coerce.number().int().default(100).describe('Sample size for analysis'),
    },
    async ({ table, column, limit }: { table: string; column?: string; limit: number }) => {
      try {
        const [schema, tableName] = table.includes('.') ? table.split('.') : ['public', table]

        const result = await runQuery(`SELECT COUNT(*) as total_rows FROM ${schema}.${tableName}`)
        const totalRows = (result[0] as Record<string, number>).total_rows

        let sql = `
          SELECT
            column_name,
            COUNT(DISTINCT col_value) as distinct_count,
            COUNT(CASE WHEN col_value IS NULL THEN 1 END) as null_count
          FROM (
            SELECT column_name, ${column ? `${column}::text` : "'constant'"} as col_value
            FROM ${schema}.${tableName}
            LIMIT $1
          ) t
        `

        if (column) {
          sql += ` GROUP BY column_name`
        }

        const stats = await runQuery(sql, [limit])

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  table: `${schema}.${tableName}`,
                  total_rows: totalRows,
                  analyzed_rows: limit,
                  stats: stats.map((s: Record<string, unknown>) => ({
                    column: s.column_name,
                    distinct_count: s.distinct_count,
                    null_count: s.null_count,
                    null_percentage: (((s.null_count as number) / limit) * 100).toFixed(2),
                  })),
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
