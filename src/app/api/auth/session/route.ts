import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/session
 *
 * Returns the current Supabase auth session from cookies.
 * Uses the server client which reads auth cookies set by the
 * middleware and login route.
 *
 * Success response: { session: Session | null }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
