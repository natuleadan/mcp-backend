import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for storage/rpc tools')
  }
  if (!_client) {
    _client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false },
    })
  }
  return _client
}
