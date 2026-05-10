import { config } from './config.js'
import { getSupabase } from './supabase.js'
import { runQuery } from './db.js'

export async function callRpc(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  if (config.backendMode === 'supabase') {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_SECRET_KEY')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(fn, args)
    if (error) throw new Error(error.message)
    return data
  }

  const keys = Object.keys(args)
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const values = keys.map(k => args[k])
  const rows = await runQuery(`SELECT * FROM ${fn}(${placeholders})`, values)
  return rows
}
