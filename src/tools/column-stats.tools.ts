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

        const totalRow = await runQuery<{ total_rows: number }>(`SELECT COUNT(*) as total_rows FROM ${schema}.${tableName}`)
        const totalRows = totalRow[0].total_rows

        let stats: Record<string, unknown>[]

        if (column) {
          stats = await runQuery(
            `SELECT
              $1 as column_name,
              COUNT(DISTINCT "${column}") as distinct_count,
              SUM(CASE WHEN "${column}" IS NULL THEN 1 ELSE 0 END) as null_count
            FROM (SELECT "${column}" FROM ${schema}.${tableName} LIMIT $2) sub`,
            [column, limit]
          )
        } else {
          stats = await runQuery(
            `SELECT
              attname,
              null_frac,
              CASE WHEN n_distinct < 0 THEN ROUND((-n_distinct) * $1) ELSE n_distinct END as distinct_count,
              CASE WHEN n_distinct < 0 THEN 'estimated' ELSE 'exact' END as distinct_type
            FROM pg_stats
            WHERE schemaname = $2 AND tablename = $3
            ORDER BY attname`,
            [totalRows, schema, tableName]
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  table: `${schema}.${tableName}`,
                  total_rows: totalRows,
                  stats: column
                    ? stats.map((s: Record<string, unknown>) => ({
                        column: s.column_name,
                        distinct_count: s.distinct_count,
                        null_count: s.null_count,
                        null_percentage: totalRows > 0 ? (((s.null_count as number) / totalRows) * 100).toFixed(2) : '0.00',
                      }))
                    : stats.map((s: Record<string, unknown>) => ({
                        column: s.attname,
                        null_frac: s.null_frac,
                        distinct_count: s.distinct_count,
                        distinct_type: s.distinct_type,
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
