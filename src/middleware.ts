import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * HôtelCI Middleware
 *
 * Handles:
 * 1. Session refresh via Supabase SSR
 * 2. Route protection (unauthenticated users → login)
 * 3. Role-based access (x-user-role, x-user-id headers)
 * 4. Security headers on all responses
 */

// Paths that are completely excluded from middleware processing
const EXCLUDED_PATHS = ['/api/', '/_next/', '/static/', '/favicon.ico', '/logo.svg']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ---- 1. Skip middleware for excluded paths ----
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Skip for files with extensions (images, fonts, etc.)
  if (pathname.match(/\.\w+$/)) {
    return NextResponse.next()
  }

  // ---- 2. Refresh Supabase auth session ----
  const { supabaseResponse, user } = await updateSession(request)

  // ---- 3. Add security headers to all responses ----
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')

  // ---- 4. Role-based headers for downstream consumption ----
  if (user) {
    const role = user.app_metadata?.role || 'unknown'
    supabaseResponse.headers.set('x-user-role', role)
    supabaseResponse.headers.set('x-user-id', user.id)

    // Authenticated user visiting root — let client-side handle dashboard display
    // No redirect needed; the frontend decides whether to show login or dashboard
  } else {
    // Unauthenticated user trying to access a protected route (anything other than /)
    if (pathname !== '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    // Unauthenticated user visiting / — let client-side show login form
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Also excludes common static file extensions via regex.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|otf)$).*)',
  ],
}
