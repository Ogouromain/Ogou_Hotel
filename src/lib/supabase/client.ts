import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Check if Supabase credentials are configured.
 * If not, the app will work in offline/demo mode.
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))
}

/**
 * Creates a Supabase client for use in Client Components.
 * Uses @supabase/ssr createBrowserClient for proper cookie-based
 * session management with SSR support.
 *
 * Returns null if Supabase credentials are not configured.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    return null
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
