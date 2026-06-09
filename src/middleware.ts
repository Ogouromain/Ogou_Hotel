import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * OGOU_Hôtel Middleware
 *
 * Handles:
 * 1. Session refresh via Supabase SSR
 * 2. Route protection (unauthenticated users → login)
 * 3. Role-based access (x-user-role, x-user-id headers)
 * 4. Security headers on all responses
 * 5. Setup route protection (x-setup-key validation)
 */

// Paths that are completely excluded from middleware processing
const EXCLUDED_PATHS = ['/_next/', '/static/', '/favicon.ico', '/logo.svg']

// ─── Role-Based Route Access Control ──────────────────────────────────────────
// Defines which roles can access which route prefixes.
// Routes not listed here are accessible to all authenticated users.
// NOTE: Individual route handlers enforce MORE GRANULAR role checks.
// For example, /api/owner/analytics only allows owner+manager even though
// the middleware allows receptionist to access /api/owner/* broadly.
// This is defense-in-depth: middleware = broad gate, handlers = fine-grained.

const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
  // Super-admin routes: only super_admin can access
  '/api/super-admin': ['super_admin'],

  // Restaurant-specific owner routes: restaurant_staff can read menu items and create orders
  // IMPORTANT: These must come BEFORE /api/owner so that the more specific
  // prefix matches first in the canAccessRoute() iteration.
  // Individual handlers still enforce fine-grained role checks.
  '/api/owner/restaurant/menu': ['owner', 'manager', 'restaurant_staff'],
  '/api/owner/restaurant/orders': ['owner', 'manager', 'receptionist', 'restaurant_staff'],

  // Stock routes: restaurant_staff can READ items and alerts (for low stock awareness)
  // Individual handlers restrict: only owner/manager can create/edit/delete items and transactions.
  '/api/owner/stocks/items': ['owner', 'manager', 'receptionist', 'restaurant_staff'],
  '/api/owner/stocks/alerts': ['owner', 'manager', 'restaurant_staff'],

  // Owner routes: broad access at middleware level
  // Individual handlers restrict: analytics/subscription/activity-log = owner+manager only,
  // employees = owner+manager only, hotel PATCH = owner+manager only, etc.
  '/api/owner': ['owner', 'manager', 'receptionist'],

  // Staff routes: all hotel staff can access
  '/api/staff': ['owner', 'manager', 'receptionist', 'housekeeper', 'restaurant_staff'],

  // Setup routes: handled separately via x-setup-key header
  '/api/setup': [],
}

/**
 * Determines if a user with the given role can access a path.
 * Returns true if the path has no role restriction or the role is allowed.
 */
function canAccessRoute(pathname: string, role: string | null): boolean {
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTE_ACCESS)) {
    if (pathname.startsWith(routePrefix)) {
      // Setup routes have their own auth via x-setup-key
      if (routePrefix === '/api/setup') return true
      // Check if user's role is in the allowed list
      return allowedRoles.includes(role || '')
    }
  }
  // Route has no specific role restriction
  return true
}

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
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  // ---- 4. Role-based headers for downstream consumption ----
  if (user) {
    const role = user.app_metadata?.role || 'unknown'
    const hotelId = user.app_metadata?.hotel_id || ''
    supabaseResponse.headers.set('x-user-role', role)
    supabaseResponse.headers.set('x-user-id', user.id)
    supabaseResponse.headers.set('x-user-hotel-id', hotelId)

    // ---- 5. Role-based route protection ----
    if (!canAccessRoute(pathname, role)) {
      // User is authenticated but doesn't have the right role for this route
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous n\'avez pas les permissions nécessaires.' },
          { status: 403 }
        )
      }
      // For page routes, redirect to home
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Authenticated user visiting root — let client-side handle dashboard display
    // No redirect needed; the frontend decides whether to show login or dashboard
  } else {
    // Unauthenticated user trying to access a protected route
    if (pathname !== '/') {
      // API routes should return 401
      if (pathname.startsWith('/api/')) {
        // Allow auth routes without authentication
        if (!pathname.startsWith('/api/auth/')) {
          // Allow setup routes without authentication — they have their own
          // x-setup-key validation in the route handlers themselves
          if (!pathname.startsWith('/api/setup/')) {
            return NextResponse.json(
              { error: 'Non authentifié. Veuillez vous connecter.' },
              { status: 401 }
            )
          }
        }
      } else {
        // Page routes redirect to home
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
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
