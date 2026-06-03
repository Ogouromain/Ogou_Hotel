import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Sign in with the admin client
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Get the user's profile
    const { data: profile, error: profileError } = await supabase
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
