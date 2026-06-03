import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password using cookie-based SSR auth.
 * Uses createServerClient from @supabase/ssr to properly set auth cookies
 * on the response, then fetches the profile via a fresh admin client
 * (bypasses RLS — avoids the context-switching bug from Étape 1).
 *
 * Request body: { email: string, password: string }
 * Success response: { user, profile, session }
 * Error responses with French messages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // Create a response object that we'll use to collect cookies set by Supabase
    const responseToCollectCookies = NextResponse.next()

    // Create a Supabase server client that reads cookies from the request
    // and writes cookies to our response object
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies so subsequent operations see them
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Set cookies on the response so the browser receives them
          cookiesToSet.forEach(({ name, value, options }) => {
            responseToCollectCookies.cookies.set(name, value, options)
          })
        },
      },
    })

    // Sign in with password — this will set auth cookies via setAll above
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Map common Supabase auth errors to French messages
      const frenchError = mapAuthError(error.message)
      return NextResponse.json({ error: frenchError }, { status: 401 })
    }

    // Use a FRESH admin client for the profile query to avoid RLS issues.
    // After signInWithPassword, the SSR client switches to the user's JWT context,
    // which may be blocked by RLS policies on the profiles table.
    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profil utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Build the JSON success response
    const successResponse = NextResponse.json({
      user: data.user,
      profile,
      session: data.session,
    })

    // Copy all cookies that Supabase set during signInWithPassword
    // from the collector response to our actual JSON response
    responseToCollectCookies.cookies.getAll().forEach((cookie) => {
      successResponse.cookies.set(cookie.name, cookie.value)
    })

    return successResponse
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

/**
 * Maps Supabase auth error messages to French equivalents.
 */
function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Identifiants invalides'
  }
  if (message.includes('Email not confirmed')) {
    return 'Email non confirmé'
  }
  if (message.includes('Too many requests')) {
    return 'Trop de tentatives, veuillez réessayer plus tard'
  }
  if (message.includes('User not found')) {
    return 'Utilisateur non trouvé'
  }
  return message
}
