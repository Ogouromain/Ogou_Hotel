import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client for use in Client Components.
 * Uses @supabase/ssr createBrowserClient for proper cookie-based
 * session management with SSR support.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
