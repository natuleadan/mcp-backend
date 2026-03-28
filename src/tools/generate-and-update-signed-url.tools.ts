import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../supabase.js'
import { getClient } from '../db.js'

export function registerGenerateAndUpdateSignedUrlTool(server: McpServer) {
  server.tool(
    'generate_and_update_signed_url',
    'Generate a signed URL for a private bucket file and update the URL in a DB media table',
    z.object({
      bucket: z.string().describe('Bucket name (e.g. prd_medias, pry_medias)'),
      path: z.string().describe('File path in the bucket (e.g. aqc/aqc-105/250gr.jpeg)'),
      expires_in: z.coerce
        .number()
        .int()
        .default(31536000)
        .describe('Expiry in seconds (default: 1 year = 31536000)'),
      table: z.string().describe('Table to update (e.g. prd_medias, pry_medias, brd_medias)'),
      id_column: z.string().default('id').describe('Primary key column name (default: id)'),
      id_value: z.string().describe('Value of the primary key to match'),
      url_column: z
        .string()
        .default('signed_url')
        .describe('Column for signed URL (default: signed_url)'),
      expires_at_column: z
        .string()
        .default('signed_url_expires_at')
        .describe('Column for expiration timestamp (default: signed_url_expires_at)'),
    }).shape,
    async ({
      bucket,
      path: filePath,
      expires_in,
      table,
      id_column,
      id_value,
      url_column,
      expires_at_column,
    }: {
      bucket: string
      path: string
      expires_in: number
      table: string
      id_column: string
      id_value: string
      url_column: string
      expires_at_column: string
    }) => {
      try {
        // 1. Generate signed URL via Supabase Storage SDK
        const supabase = getSupabase()
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expires_in)
        if (error) throw new Error(error.message)
        const signedUrl = data.signedUrl

        // 2. Calculate expiration timestamp (NOW + expires_in seconds)
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

        // 3. Update DB with transaction
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const sql = `UPDATE ${table} SET ${url_column} = $1, ${expires_at_column} = $2 WHERE ${id_column} = $3`
          const result = await client.query(sql, [signedUrl, expiresAt, id_value])
          await client.query('COMMIT')

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    bucket,
                    filePath,
                    signedUrl,
                    expiresAt,
                    table,
                    rowsUpdated: result.rowCount,
                  },
                  null,
                  2
                ),
              },
            ],
          }
        } catch (dbErr) {
          await client.query('ROLLBACK')
          throw dbErr
        } finally {
          await client.end()
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
