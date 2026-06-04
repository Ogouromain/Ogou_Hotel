import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis (email, password, firstName, lastName)' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Step 1: Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // If user already exists, try to get the existing user
      if (authError.message.includes('already registered')) {
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) {
          return NextResponse.json({ error: 'Erreur lors de la recherche de l\'utilisateur existant' }, { status: 500 })
        }
        const existingUser = existingUsers.users.find(u => u.email === email)
        if (existingUser) {
          // Check if profile already exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', existingUser.id)
            .single()

          if (existingProfile) {
            return NextResponse.json({ 
              message: 'Le Super Administrateur existe déjà',
              userId: existingUser.id 
            })
          }

          // Create profile for existing user
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: existingUser.id,
              hotel_id: null,
              first_name: firstName,
              last_name: lastName,
              role: 'super_admin',
              status: 'active',
            })

          if (profileError) {
            return NextResponse.json({ error: `Erreur création profil: ${profileError.message}` }, { status: 500 })
          }

          return NextResponse.json({ 
            message: 'Super Administrateur créé avec succès (profil ajouté à l\'utilisateur existant)',
            userId: existingUser.id 
          })
        }
      }
      return NextResponse.json({ error: `Erreur Auth: ${authError.message}` }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Échec de la création de l\'utilisateur' }, { status: 500 })
    }

    // Step 2: Create profile in public.profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        hotel_id: null,
        first_name: firstName,
        last_name: lastName,
        role: 'super_admin',
        status: 'active',
      })

    if (profileError) {
      // If profile creation fails, try to clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: `Erreur création profil: ${profileError.message}` }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Super Administrateur créé avec succès',
      userId: authData.user.id 
    })
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
