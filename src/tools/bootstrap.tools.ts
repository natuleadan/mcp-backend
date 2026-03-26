import { z } from 'zod'
import { config } from '../config.js'
import { getClient } from '../db.js'

const NAMESPACE = config.icebergNamespace || 'audit'
const WAREHOUSE = config.icebergWarehouse || 'aqc-audit-lake'

export const bootstrapTools = [
  {
    name: 'bootstrap_iceberg',
    description:
      'Bootstrap the Iceberg FDW on Postgres: creates namespace + tables in catalog, configures FDW server, maps foreign tables, and verifies connection.',
    inputSchema: z.object({
      dry_run: z.boolean().default(false).describe('If true, show SQL without executing'),
    }),
    handler: async ({ dry_run }: { dry_run: boolean }) => {
      const log: string[] = []

      if (!config.catalogUri || !config.icebergToken) {
        return '❌ Missing CATALOG_URI or ICEBERG_TOKEN in .env'
      }

      // Step 1: Bootstrap Iceberg catalog (namespace + tables)
      log.push('=== Step 1: Iceberg Catalog ===')
      try {
        const { IcebergRestCatalog } = await import('iceberg-js')
        const catalog = new IcebergRestCatalog({
          baseUrl: config.catalogUri,
          catalogName: WAREHOUSE,
          auth: { type: 'bearer' as const, token: config.icebergToken },
          accessDelegation: ['vended-credentials'],
        })

        // Create namespace
        try {
          await catalog.createNamespace({ namespace: [NAMESPACE] })
          log.push(`✅ Namespace '${NAMESPACE}' created`)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('already exists') || (e as { status?: number }).status === 409) {
            log.push(`ℹ️  Namespace '${NAMESPACE}' already exists`)
          } else {
            log.push(`⚠️  Namespace: ${msg}`)
          }
        }

        // Create tables
        const ICEBERG_TABLES: Record<
          string,
          {
            type: 'struct'
            fields: { id: number; name: string; type: string; required: boolean }[]
            'schema-id': number
          }
        > = {
          aud_registry: {
            type: 'struct',
            'schema-id': 0,
            fields: [
              { id: 1, name: 'id', type: 'uuid', required: false },
              { id: 2, name: 'table_name', type: 'string', required: false },
              { id: 3, name: 'record_id', type: 'uuid', required: false },
              { id: 4, name: 'operation', type: 'string', required: false },
              { id: 5, name: 'old_data', type: 'struct', required: false },
              { id: 6, name: 'new_data', type: 'struct', required: false },
              { id: 7, name: 'user_id', type: 'uuid', required: false },
              { id: 8, name: 'created_at', type: 'timestamptz', required: false },
            ],
          },
          aud_analytics: {
            type: 'struct',
            'schema-id': 0,
            fields: [
              { id: 1, name: 'id', type: 'uuid', required: false },
              { id: 2, name: 'user_id', type: 'uuid', required: false },
              { id: 3, name: 'anonymous_id', type: 'uuid', required: false },
              { id: 4, name: 'ip_hash', type: 'string', required: false },
              { id: 5, name: 'country_code', type: 'string', required: false },
              { id: 6, name: 'lang_param', type: 'string', required: false },
              { id: 7, name: 'event_type', type: 'string', required: false },
              { id: 8, name: 'page_path', type: 'string', required: false },
              { id: 9, name: 'event_data', type: 'string', required: false },
              { id: 10, name: 'metadata', type: 'string', required: false },
              { id: 11, name: 'created_at', type: 'timestamptz', required: false },
            ],
          },
          aud_storage: {
            type: 'struct',
            'schema-id': 0,
            fields: [
              { id: 1, name: 'id', type: 'uuid', required: false },
              { id: 2, name: 'bucket_id', type: 'string', required: false },
              { id: 3, name: 'object_path', type: 'string', required: false },
              { id: 4, name: 'object_id', type: 'string', required: false },
              { id: 5, name: 'action', type: 'string', required: false },
              { id: 6, name: 'user_id', type: 'uuid', required: false },
              { id: 7, name: 'user_role', type: 'string', required: false },
              { id: 8, name: 'ip_address', type: 'string', required: false },
              { id: 9, name: 'metadata', type: 'struct', required: false },
              { id: 10, name: 'status', type: 'string', required: false },
              { id: 11, name: 'error_message', type: 'string', required: false },
              { id: 12, name: 'created_at', type: 'timestamptz', required: false },
            ],
          },
          aud_ip_blocks: {
            type: 'struct',
            'schema-id': 0,
            fields: [
              { id: 1, name: 'id', type: 'uuid', required: false },
              { id: 2, name: 'ip_address', type: 'string', required: false },
              { id: 3, name: 'block_reason', type: 'string', required: false },
              { id: 4, name: 'duration_minutes', type: 'integer', required: false },
              { id: 5, name: 'escalation_tier', type: 'integer', required: false },
              { id: 6, name: 'counter_value', type: 'integer', required: false },
              { id: 7, name: 'threshold_reached', type: 'integer', required: false },
              { id: 8, name: 'metadata', type: 'struct', required: false },
              { id: 9, name: 'triggered_at', type: 'timestamptz', required: false },
              { id: 10, name: 'expires_at', type: 'timestamptz', required: false },
              { id: 11, name: 'created_at', type: 'timestamptz', required: false },
              { id: 12, name: 'updated_at', type: 'timestamptz', required: false },
            ],
          },
          aud_cookies: {
            type: 'struct',
            'schema-id': 0,
            fields: [
              { id: 1, name: 'id', type: 'uuid', required: false },
              { id: 2, name: 'user_id', type: 'uuid', required: false },
              { id: 3, name: 'anonymous_id', type: 'uuid', required: false },
              { id: 4, name: 'ip_hash', type: 'string', required: false },
              { id: 5, name: 'country_code', type: 'string', required: false },
              { id: 6, name: 'lang_param', type: 'string', required: false },
              { id: 7, name: 'consent_categories', type: 'string', required: false },
              { id: 8, name: 'user_agent', type: 'string', required: false },
              { id: 9, name: 'created_at', type: 'timestamptz', required: false },
            ],
          },
        }

        for (const [tableName, schema] of Object.entries(ICEBERG_TABLES)) {
          try {
            await catalog.createTable(
              { namespace: [NAMESPACE] },
              {
                name: tableName,
                schema,
                'partition-spec': { 'spec-id': 0, fields: [] },
                'write-order': { 'order-id': 0, fields: [] },
                properties: { 'write.format.default': 'parquet' },
              }
            )
            log.push(`  ✅ ${NAMESPACE}.${tableName} created`)
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes('already exists') || (e as { status?: number }).status === 409) {
              log.push(`  ℹ️  ${NAMESPACE}.${tableName} already exists`)
            } else {
              log.push(`  ⚠️  ${tableName}: ${msg}`)
            }
          }
        }
      } catch (e: unknown) {
        log.push(`❌ Iceberg catalog error: ${e instanceof Error ? e.message : String(e)}`)
      }

      // Step 2: Configure Postgres FDW
      log.push('\n=== Step 2: Postgres FDW ===')
      const fdwSql = `
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

DROP SERVER IF EXISTS iceberg_server CASCADE;
CREATE SERVER iceberg_server
  FOREIGN DATA WRAPPER iceberg_wrapper
  OPTIONS (
    aws_access_key_id '${config.awsAccessKeyId}',
    aws_secret_access_key '${config.awsSecretAccessKey}',
    token '${config.icebergToken}',
    region_name 'us-east-1',
    catalog_uri '${config.catalogUri}',
    warehouse '${WAREHOUSE}',
    "s3.endpoint" '${config.s3Endpoint}'
  );

CREATE SCHEMA IF NOT EXISTS iceberg;

DROP FOREIGN TABLE IF EXISTS iceberg.aud_registry_lake CASCADE;
DROP FOREIGN TABLE IF EXISTS iceberg.aud_analytics_lake CASCADE;
DROP FOREIGN TABLE IF EXISTS iceberg.aud_storage_lake CASCADE;
DROP FOREIGN TABLE IF EXISTS iceberg.aud_ip_blocks_lake CASCADE;
DROP FOREIGN TABLE IF EXISTS iceberg.aud_cookies_lake CASCADE;

CREATE FOREIGN TABLE iceberg.aud_registry_lake (
  id uuid, table_name text, record_id uuid, operation text, old_data jsonb, new_data jsonb, user_id uuid, created_at timestamptz
) SERVER iceberg_server OPTIONS (table '${NAMESPACE}.aud_registry', rowid_column 'id');

CREATE FOREIGN TABLE iceberg.aud_analytics_lake (
  id uuid, user_id uuid, anonymous_id uuid, ip_hash text, country_code text, lang_param text, event_type text, page_path text, event_data jsonb, metadata jsonb, created_at timestamptz
) SERVER iceberg_server OPTIONS (table '${NAMESPACE}.aud_analytics', rowid_column 'id');

CREATE FOREIGN TABLE iceberg.aud_storage_lake (
  id uuid, bucket_id text, object_path text, object_id text, action text, user_id uuid, user_role text, ip_address text, metadata jsonb, status text, error_message text, created_at timestamptz
) SERVER iceberg_server OPTIONS (table '${NAMESPACE}.aud_storage', rowid_column 'id');

CREATE FOREIGN TABLE iceberg.aud_ip_blocks_lake (
  id uuid, ip_address text, block_reason text, duration_minutes integer, escalation_tier integer, counter_value integer, threshold_reached integer, metadata jsonb, triggered_at timestamptz, expires_at timestamptz, created_at timestamptz, updated_at timestamptz
) SERVER iceberg_server OPTIONS (table '${NAMESPACE}.aud_ip_blocks', rowid_column 'id');

CREATE FOREIGN TABLE iceberg.aud_cookies_lake (
  id uuid, user_id uuid, anonymous_id uuid, ip_hash text, country_code text, lang_param text, consent_categories text, user_agent text, created_at timestamptz
) SERVER iceberg_server OPTIONS (table '${NAMESPACE}.aud_cookies', rowid_column 'id');
      `

      if (dry_run) {
        log.push('DRY RUN — SQL that would be executed:')
        log.push(fdwSql)
        return log.join('\n')
      }

      const client = await getClient()
      try {
        await client.query('BEGIN')
        await client.query(fdwSql)
        await client.query('COMMIT')
        log.push('✅ FDW server configured')
        log.push('✅ Foreign tables mapped')
      } catch (e: unknown) {
        await client.query('ROLLBACK')
        log.push(`❌ Postgres FDW error: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await client.end()
      }

      // Step 3: Test
      log.push('\n=== Step 3: Verify ===')
      const testClient = await getClient()
      try {
        const r1 = await testClient.query('SELECT COUNT(*) as cnt FROM iceberg.aud_analytics_lake')
        const r2 = await testClient.query('SELECT COUNT(*) as cnt FROM iceberg.aud_registry_lake')
        log.push(`✅ aud_analytics_lake: ${r1.rows[0]?.cnt} rows`)
        log.push(`✅ aud_registry_lake: ${r2.rows[0]?.cnt} rows`)
      } catch (e: unknown) {
        log.push(`⚠️  Test query: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await testClient.end()
      }

      return log.join('\n')
    },
  },
]
