import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/register
 * 
 * Full registration flow:
 * 1. Validate the activation code
 * 2. Create user in Supabase Auth
 * 3. Create hotel record
 * 4. Create owner profile (triggers JWT sync via trigger_sync_profile_metadata)
 * 5. Mark activation code as used
 * 6. Create subscription
 * 7. If any step fails after Auth user creation, clean up (delete user)
 * 8. Return success with session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      activationCode,
      hotelName,
      hotelCity,
      hotelPhone,
      hotelAddress,
      firstName,
      lastName,
      email,
      password,
    } = body

    // ─── Validate all required fields ─────────────────────────────
    const missingFields: string[] = []
    if (!activationCode) missingFields.push('Code d\'activation')
    if (!hotelName) missingFields.push('Nom de l\'établissement')
    if (!hotelCity) missingFields.push('Ville')
    if (!hotelPhone) missingFields.push('Téléphone de l\'hôtel')
    if (!firstName) missingFields.push('Prénom')
    if (!lastName) missingFields.push('Nom')
    if (!email) missingFields.push('Email')
    if (!password) missingFields.push('Mot de passe')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants : ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Veuillez entrer une adresse e-mail valide' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalizedCode = activationCode.trim().toUpperCase()

    // ─── ACTION 1: Validate the activation code ────────────────────
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select(`
        id,
        code,
        status,
        expires_at,
        duration_months,
        plan_id,
        created_by,
        subscription_plans (
          id,
          name,
          price_fcfa
        )
      `)
      .eq('code', normalizedCode)
      .single()

    if (codeError || !codeData) {
      return NextResponse.json(
        { error: 'Code d\'activation introuvable. Veuillez vérifier et réessayer.' },
        { status: 404 }
      )
    }

    if (codeData.status !== 'unused') {
      const msg = codeData.status === 'used'
        ? 'Ce code d\'activation a déjà été utilisé.'
        : 'Ce code d\'activation a expiré.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const expiresAt = new Date(codeData.expires_at)
    if (expiresAt < new Date()) {
      await supabase
        .from('activation_codes')
        .update({ status: 'expired' })
        .eq('id', codeData.id)
      return NextResponse.json(
        { error: 'Ce code d\'activation a expiré.' },
        { status: 400 }
      )
    }

    const plan = codeData.subscription_plans as unknown as {
      id: string
      name: string
      price_fcfa: number
    }

    // ─── ACTION 2: Create user in Supabase Auth ────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authError) {
      const message = authError.message.includes('already registered')
        ? 'Cette adresse e-mail est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse.'
        : `Erreur lors de la création du compte : ${authError.message}`
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Échec de la création du compte utilisateur' },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // ─── Helper: cleanup orphaned auth user ─────────────────────────
    async function cleanupOrphanedUser(reason: string) {
      console.error(`Cleaning up orphaned user ${userId}: ${reason}`)
      await supabase.auth.admin.deleteUser(userId)
    }

    // ─── ACTION 3: Create the hotel ────────────────────────────────
    const { data: hotelData, error: hotelError } = await supabase
      .from('hotels')
      .insert({
        name: hotelName.trim(),
        city: hotelCity.trim(),
        phone: hotelPhone.trim(),
        address: hotelAddress?.trim() || null,
        email: email.trim().toLowerCase(),
        status: 'active',
      })
      .select('id, name')
      .single()

    if (hotelError || !hotelData) {
      await cleanupOrphanedUser(`Hotel creation failed: ${hotelError?.message}`)
      return NextResponse.json(
        { error: `Erreur lors de la création de l'hôtel : ${hotelError?.message || 'Erreur inconnue'}` },
        { status: 500 }
      )
    }

    const hotelId = hotelData.id

    // ─── ACTION 4: Create the owner profile ────────────────────────
    // This triggers `trigger_sync_profile_metadata` which injects
    // role='owner' and hotel_id into auth.users.raw_app_meta_data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        hotel_id: hotelId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'owner',
        phone: hotelPhone.trim(),
        status: 'active',
      })

    if (profileError) {
      // Cleanup: delete hotel, then auth user
      await supabase.from('hotels').delete().eq('id', hotelId)
      await cleanupOrphanedUser(`Profile creation failed: ${profileError.message}`)
      return NextResponse.json(
        { error: `Erreur lors de la création du profil : ${profileError.message}` },
        { status: 500 }
      )
    }

    // ─── ACTION 5: Mark activation code as used (atomic claim) ─────
    const { error: claimError } = await supabase
      .from('activation_codes')
      .update({
        status: 'used',
        used_by_hotel_id: hotelId,
        used_at: new Date().toISOString(),
      })
      .eq('id', codeData.id)
      .eq('status', 'unused') // Optimistic lock: only claim if still unused

    if (claimError) {
      // Code was consumed by another request between validation and claim
      // Cleanup everything
      await supabase.from('profiles').delete().eq('id', userId)
      await supabase.from('hotels').delete().eq('id', hotelId)
      await cleanupOrphanedUser('Activation code claim failed (race condition)')
      return NextResponse.json(
        { error: 'Ce code d\'activation vient d\'être utilisé par quelqu\'un d\'autre. Veuillez contacter l\'administrateur.' },
        { status: 409 }
      )
    }

    // ─── ACTION 6: Create the subscription ─────────────────────────
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + codeData.duration_months)

    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        hotel_id: hotelId,
        plan_id: codeData.plan_id,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: 'active',
      })

    if (subscriptionError) {
      // Subscription failed, but the hotel and profile are created.
      // Log the error but don't fail the registration — admin can fix manually.
      console.error('Subscription creation failed after registration:', subscriptionError)
      // We don't rollback everything for a subscription failure — the user can still log in
    }

    // ─── ACTION 7: Return success ──────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Votre hôtel a été créé avec succès !',
      hotel: {
        id: hotelId,
        name: hotelData.name,
        city: hotelCity.trim(),
      },
      plan: {
        name: plan.name,
        price_fcfa: plan.price_fcfa,
      },
      subscription: {
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: subscriptionError ? 'pending' : 'active',
      },
      user: {
        id: userId,
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'owner',
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'inscription. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
