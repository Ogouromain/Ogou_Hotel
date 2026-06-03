import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    // Use a separate client for auth sign-in
    const authClient = createAdminClient()
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Use a fresh admin client for the profile query to avoid RLS issues.
    // After signInWithPassword, the client switches to the user's JWT context,
    // which may be blocked by RLS policies on the profiles table.
    const dbClient = createAdminClient()
    const { data: profile, error: profileError } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({
      user: data.user,
      profile,
      session: data.session,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
