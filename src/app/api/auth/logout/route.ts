import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * POST /api/auth/logout
 *
 * Signs out the current user by clearing the Supabase auth session.
 * Uses createServerClient from @supabase/ssr to properly clear
 * auth cookies from the response.
 *
 * Success response: { success: true }
 */
export async function POST(request: NextRequest) {
  try {
    // Create a response object to collect cookie deletions
    const responseToCollectCookies = NextResponse.next()

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            responseToCollectCookies.cookies.set(name, value, options)
          })
        },
      },
    })

    // Sign out — this will clear auth cookies via setAll
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      // Still proceed to clear cookies even if signOut fails
    }

    // Build the success response
    const successResponse = NextResponse.json({ success: true })

    // Copy all cookie changes (deletions) from Supabase to our response
    responseToCollectCookies.cookies.getAll().forEach((cookie) => {
      successResponse.cookies.set(cookie.name, cookie.value)
    })

    // Also explicitly clear all known Supabase auth cookie patterns
    // to ensure a clean logout even if the SSR client didn't clear them all
    const authCookieNames = request.cookies
      .getAll()
      .map((c) => c.name)
      .filter(
        (name) =>
          name.startsWith('sb-') || name.includes('supabase')
      )

    for (const name of authCookieNames) {
      successResponse.cookies.set(name, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    }

    return successResponse
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
