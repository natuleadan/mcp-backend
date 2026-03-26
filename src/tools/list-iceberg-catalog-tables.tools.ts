import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { config } from '../config.js'

async function getIcebergCatalog() {
  if (!config.catalogUri || !config.icebergToken) {
    throw new Error(
      'Iceberg not configured — set CATALOG_URI and ICEBERG_TOKEN (service_role JWT of the iceberg Supabase project) in .env'
    )
  }
  const { IcebergRestCatalog } = await import('iceberg-js')
  return new IcebergRestCatalog({
    baseUrl: config.catalogUri,
    catalogName: config.icebergWarehouse,
    auth: { type: 'bearer' as const, token: config.icebergToken },
  })
}

export function registerListIcebergCatalogTablesTool(server: McpServer) {
  server.tool(
    'list_iceberg_catalog_tables',
    'List tables directly from the Iceberg REST Catalog (requires CATALOG_URI + AWS credentials)',
    z.object({
      namespace: z
        .string()
        .optional()
        .describe('Namespace to list (defaults to ICEBERG_NAMESPACE from config)'),
    }).shape,
    async ({ namespace }: { namespace?: string }) => {
      try {
        const catalog = await getIcebergCatalog()
        if (namespace) {
          const tables = await catalog.listTables({ namespace: [namespace] })
          return {
            content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }],
          }
        }
        // List all namespaces + their tables
        const namespaces = await catalog.listNamespaces()
        const result: Record<string, unknown[]> = {}
        for (const ns of namespaces) {
          const nsPath = Array.isArray(ns.namespace) ? ns.namespace : [ns.namespace]
          const tables = await catalog.listTables({ namespace: nsPath })
          result[nsPath.join('.')] = tables.map((t: { name: string }) => t.name)
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
