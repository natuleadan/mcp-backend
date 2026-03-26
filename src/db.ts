import pg from 'pg'
import { config } from './config.js'

const { Client } = pg

export async function getClient() {
  const client = new Client({ connectionString: config.postgresUrl })
  await client.connect()
  return client
}

export async function runSql(sql: string): Promise<void> {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

export async function runQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  timeoutMs = 10_000
): Promise<T[]> {
  const client = await getClient()
  try {
    await client.query(`SET statement_timeout = ${timeoutMs}`)
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    await client.end()
  }
}
