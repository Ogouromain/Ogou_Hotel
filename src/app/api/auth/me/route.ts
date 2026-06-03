import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user and their profile.
 * Uses the Supabase server client (cookie-based) to get the user,
 * then a fresh admin client to fetch the profile (bypasses RLS).
 *
 * This is the primary endpoint for the AuthContext to check session state.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get the current user from the session cookies
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null, profile: null })
    }

    // Use a fresh admin client to fetch the profile (bypasses RLS)
    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      // User exists in auth but has no profile — return user without profile
      console.warn('Profile not found for user:', user.id, profileError)
      return NextResponse.json({ user, profile: null })
    }

    return NextResponse.json({ user, profile })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
