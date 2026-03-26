import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runQuery } from '../db.js'

export function registerTableInfoTool(server: McpServer) {
  server.tool(
    'table_info',
    'Describe table schema: columns, types, constraints, indexes',
    {
      table: z.string().describe("Table name (e.g. 'users' or 'public.users')"),
    },
    async ({ table }: { table: string }) => {
      try {
        const [schema, tableName] = table.includes('.') ? table.split('.') : ['public', table]

        const columns = await runQuery(
          `SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
          [schema, tableName]
        )

        if (!columns.length) {
          return {
            content: [{ type: 'text', text: `❌ Table ${schema}.${tableName} not found` }],
          }
        }

        const constraints = await runQuery(
          `SELECT
            constraint_name,
            constraint_type
          FROM information_schema.table_constraints
          WHERE table_schema = $1 AND table_name = $2`,
          [schema, tableName]
        )

        const indexes = await runQuery(
          `SELECT
            indexname,
            indexdef
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2`,
          [schema, tableName]
        )

        const result = {
          table: `${schema}.${tableName}`,
          columns: columns.map((c: Record<string, unknown>) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable,
            default: c.column_default,
          })),
          constraints: constraints.map((c: Record<string, unknown>) => ({
            name: c.constraint_name,
            type: c.constraint_type,
          })),
          indexes: indexes.map((i: Record<string, unknown>) => ({
            name: i.indexname,
          })),
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
