import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseSecretKey) return null
  if (!_client) {
    _client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false },
    })
  }
  return _client
}
