import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Check if Supabase credentials are configured.
 * If not, the app will work in offline/demo mode.
 */
function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))
}

/**
 * Middleware helper for Supabase session management.
 *
 * Creates a Supabase client that can read cookies from the request
 * and write cookies to the response. Refreshes the session if needed.
 *
 * IMPORTANT: Avoid writing any logic between createServerClient and
 * supabase.auth.getUser(). A simple mistake could make it very hard to debug
 * issues with users being randomly logged out.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // If Supabase is not configured, skip session management
  if (!isSupabaseConfigured()) {
    return { supabase: null, supabaseResponse, user: null, session: null } as {
      supabase: null
      supabaseResponse: NextResponse
      user: null
      session: null
    }
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Set cookies on the request so they're available for subsequent middleware
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        // Create a new response with the updated request cookies
        supabaseResponse = NextResponse.next({ request })
        // Set cookies on the response so the browser receives them
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). This ensures session refresh happens correctly.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabase, supabaseResponse, user, session } as {
    supabase: ReturnType<typeof supabase>
    supabaseResponse: NextResponse
    user: User | null
    session: import('@supabase/supabase-js').Session | null
  }
}
