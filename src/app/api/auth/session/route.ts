import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken } = body

    if (!accessToken) {
      return NextResponse.json({ error: 'Token d\'accès requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ user, profile })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
