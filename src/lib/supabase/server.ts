import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * Reads cookies from the request via Next.js cookies() API.
 * Cookie setting is a no-op in Server Components (middleware handles session refresh).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The setAll method is called from a Server Component where
          // cookies cannot be set. This can be ignored if you have
          // middleware refreshing user sessions.
        }
      },
    },
  })
}

/**
 * Creates a Supabase client with explicit cookie access for middleware
 * or other contexts where you need to control cookie reading and writing.
 * Pass your own getAll and setAll functions.
 */
export function createClientWithCookies(cookieMethods: {
  getAll: () => Array<{ name: string; value: string }>
  setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void
}) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: cookieMethods,
  })
}
