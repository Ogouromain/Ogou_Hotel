import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Check if Supabase admin credentials are configured.
 */
export function isSupabaseAdminConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceRoleKey && supabaseUrl.startsWith('http'))
}

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses Row Level Security (RLS) and should only be used
 * in server-side code for administrative operations.
 *
 * Returns null if Supabase credentials are not configured.
 */
export function createAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    return null
  }
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
