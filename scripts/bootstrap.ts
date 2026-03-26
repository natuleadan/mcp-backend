#!/usr/bin/env tsx
/**
 * Bootstrap script — verifies environment and tests all connections.
 * If .env is missing, prompts for required variables interactively.
 *
 * Usage: pnpm bootstrap
 */

import { createInterface } from 'readline'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(__dirname, '../.env')

// ─── Output helpers ──────────────────────────────────────────────────────────

function log(msg: string)   { process.stdout.write(`\n${msg}\n`) }
function ok(msg: string)    { process.stdout.write(`✅ ${msg}\n`) }
function warn(msg: string)  { process.stdout.write(`⚠️  ${msg}\n`) }
function fail(msg: string): never { process.stderr.write(`❌ ${msg}\n`); process.exit(1) }
function section(msg: string) { process.stdout.write(`\n── ${msg} ──\n`) }

// ─── Interactive prompt ───────────────────────────────────────────────────────

function prompt(rl: ReturnType<typeof createInterface>, question: string, defaultVal = ''): Promise<string> {
  return new Promise(resolve => {
    const hint = defaultVal ? ` (default: ${defaultVal})` : ''
    rl.question(`  ${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultVal)
    })
  })
}

function promptSecret(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(`  ${question}: `)
    // Hide input on TTY
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    let input = ''
    const onData = (char: Buffer) => {
      const c = char.toString()
      if (c === '\n' || c === '\r' || c === '\u0003') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(input)
      } else if (c === '\u007f') {
        input = input.slice(0, -1)
      } else {
        input += c
        process.stdout.write('*')
      }
    }
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

// ─── .env parser / writer ────────────────────────────────────────────────────

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

function serializeEnv(vars: Record<string, string>): string {
  return [
    '# PostgreSQL direct connection',
    `POSTGRES_URL=${vars.POSTGRES_URL ?? ''}`,
    '',
    '# Supabase REST API',
    `SUPABASE_URL=${vars.SUPABASE_URL ?? ''}`,
    `SUPABASE_PUBLISHABLE_KEY=${vars.SUPABASE_PUBLISHABLE_KEY ?? ''}`,
    `SUPABASE_SECRET_KEY=${vars.SUPABASE_SECRET_KEY ?? ''}`,
    '',
    '# Iceberg / Data Lake (optional)',
    `CATALOG_URI=${vars.CATALOG_URI ?? ''}`,
    `AWS_ACCESS_KEY_ID=${vars.AWS_ACCESS_KEY_ID ?? ''}`,
    `AWS_SECRET_ACCESS_KEY=${vars.AWS_SECRET_ACCESS_KEY ?? ''}`,
    `S3_ENDPOINT=${vars.S3_ENDPOINT ?? ''}`,
    `ICEBERG_WAREHOUSE=${vars.ICEBERG_WAREHOUSE ?? 'nla-audit-lake'}`,
    `ICEBERG_NAMESPACE=${vars.ICEBERG_NAMESPACE ?? 'audit'}`,
    `CATALOG_TOKEN=${vars.CATALOG_TOKEN ?? ''}`,
  ].join('\n') + '\n'
}

// ─── Connection checks ────────────────────────────────────────────────────────

async function checkPostgres(url: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  try {
    await client.connect()
    await client.query('SELECT 1')
    ok('Postgres connection successful')
  } catch (e) {
    fail(`Postgres connection failed: ${String(e)}`)
  } finally {
    await client.end().catch(() => {})
  }
}

async function checkSupabase(url: string, key: string): Promise<void> {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok || res.status === 400) {
      ok('Supabase REST connection successful')
    } else {
      warn(`Supabase responded with status ${res.status} — check your keys`)
    }
  } catch (e) {
    warn(`Supabase connection failed: ${String(e)}`)
  }
}

async function checkIceberg(catalogUri: string, token: string, warehouse: string): Promise<void> {
  if (!catalogUri || !token) {
    warn('Iceberg not configured — skipping (optional)')
    return
  }
  try {
    const url = `${catalogUri}/v1/config${warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : ''}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      ok('Iceberg catalog connection successful')
    } else {
      warn(`Iceberg responded with status ${res.status}`)
    }
  } catch (e) {
    warn(`Iceberg connection failed: ${String(e)}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('🔧 mcp-backend bootstrap')

  let vars: Record<string, string> = {}

  // ── Load or create .env ────────────────────────────────────────────────────
  if (existsSync(ENV_PATH)) {
    ok(`.env found at ${ENV_PATH}`)
    vars = parseEnv(readFileSync(ENV_PATH, 'utf-8'))
  } else {
    warn(`.env not found — let's create it`)
    log('Enter your credentials (leave blank to skip optional fields):')

    const rl = createInterface({ input: process.stdin, output: process.stdout })

    section('PostgreSQL')
    vars.POSTGRES_URL = await prompt(rl, 'POSTGRES_URL', 'postgresql://postgres:PASSWORD@db.SUPABASEID.supabase.co:5432/postgres')

    section('Supabase')
    vars.SUPABASE_URL = await prompt(rl, 'SUPABASE_URL', 'https://SUPABASEID.supabase.co')
    vars.SUPABASE_PUBLISHABLE_KEY = await prompt(rl, 'SUPABASE_PUBLISHABLE_KEY')
    vars.SUPABASE_SECRET_KEY = await prompt(rl, 'SUPABASE_SECRET_KEY')

    section('Iceberg / Data Lake (optional — press Enter to skip)')
    vars.CATALOG_URI = await prompt(rl, 'CATALOG_URI')
    vars.AWS_ACCESS_KEY_ID = await prompt(rl, 'AWS_ACCESS_KEY_ID')
    vars.AWS_SECRET_ACCESS_KEY = await prompt(rl, 'AWS_SECRET_ACCESS_KEY')
    vars.S3_ENDPOINT = await prompt(rl, 'S3_ENDPOINT')
    vars.ICEBERG_WAREHOUSE = await prompt(rl, 'ICEBERG_WAREHOUSE', 'nla-audit-lake')
    vars.ICEBERG_NAMESPACE = await prompt(rl, 'ICEBERG_NAMESPACE', 'audit')
    vars.CATALOG_TOKEN = await prompt(rl, 'CATALOG_TOKEN (same as SUPABASE_SECRET_KEY if using Supabase)')

    rl.close()

    writeFileSync(ENV_PATH, serializeEnv(vars), 'utf-8')
    ok(`.env created at ${ENV_PATH}`)
  }

  // ── Validate required vars ─────────────────────────────────────────────────
  section('Validating required variables')
  const required: Array<keyof typeof vars> = ['POSTGRES_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']
  let missing = false
  for (const key of required) {
    if (!vars[key]) {
      process.stdout.write(`❌ Missing: ${key}\n`)
      missing = true
    } else {
      process.stdout.write(`✅ ${key} is set\n`)
    }
  }
  if (missing) fail('Some required variables are missing. Edit .env and re-run pnpm bootstrap.')

  // ── Test connections ───────────────────────────────────────────────────────
  section('Testing connections')
  await checkPostgres(vars.POSTGRES_URL)
  await checkSupabase(vars.SUPABASE_URL, vars.SUPABASE_SECRET_KEY)
  await checkIceberg(vars.CATALOG_URI ?? '', vars.CATALOG_TOKEN ?? '', vars.ICEBERG_WAREHOUSE ?? '')

  log('🎉 Bootstrap complete.\n   pnpm start     → start the MCP server\n   pnpm db:all    → run DB migrations')
}

main().catch(e => fail(String(e)))
