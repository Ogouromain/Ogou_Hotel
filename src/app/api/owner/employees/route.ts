import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * GET /api/owner/employees
 * List all employees (profiles) for the owner's hotel.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    const { data: employees, error } = await adminClient
      .from('profiles')
      .select('id, first_name, last_name, role, phone, status, created_at')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('Owner employees GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/employees
 * Create a new employee (Auth user + profile) with subscription limit validation.
 * Returns the generated password for the employee.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { first_name, last_name, email, phone, role } = body

    // ─── Validate required fields ──────────────────────────────
    if (!first_name || !last_name || !email || !role) {
      return NextResponse.json(
        { error: 'Prénom, nom, email et rôle sont requis' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['manager', 'receptionist', 'restaurant_staff', 'housekeeper']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rôle invalide. Rôles autorisés : ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // ─── APPLICATION-LEVEL LIMIT CHECK ─────────────────────────
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('id, subscription_plans(max_receptionists, max_managers)')
      .eq('hotel_id', hotelId)
      .eq('status', 'active')
      .maybeSingle()

    const planLimits = subscription?.subscription_plans as unknown as {
      max_receptionists: number
      max_managers: number
    } | null

    if (planLimits) {
      if (role === 'receptionist') {
        const { count } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', hotelId)
          .eq('role', 'receptionist')
          .eq('status', 'active')

        if ((count ?? 0) >= planLimits.max_receptionists) {
          return NextResponse.json(
            { error: `Limite de réceptionnistes atteinte (${planLimits.max_receptionists} max) pour votre plan actuel. Mettez à niveau votre abonnement.` },
            { status: 403 }
          )
        }
      }

      if (role === 'manager') {
        const { count } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', hotelId)
          .eq('role', 'manager')
          .eq('status', 'active')

        if ((count ?? 0) >= planLimits.max_managers) {
          return NextResponse.json(
            { error: `Limite de managers atteinte (${planLimits.max_managers} max) pour votre plan actuel. Mettez à niveau votre abonnement.` },
            { status: 403 }
          )
        }
      }
    }

    // ─── Check if email already used ───────────────────────────
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('phone', phone?.trim() || '')
      .maybeSingle()

    // ─── Generate a secure random password ─────────────────────
    const generatedPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12)

    // ─── Create Auth user ─────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: generatedPassword,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Cette adresse e-mail est déjà utilisée par un autre compte.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: `Erreur lors de la création du compte : ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Échec de la création du compte' }, { status: 500 })
    }

    const userId = authData.user.id

    // ─── Cleanup helper ────────────────────────────────────────
    async function cleanupOrphanedUser(reason: string) {
      console.error(`Cleaning up orphaned user ${userId}: ${reason}`)
      await adminClient.auth.admin.deleteUser(userId)
    }

    // ─── Create profile ───────────────────────────────────────
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        hotel_id: hotelId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role,
        phone: phone?.trim() || null,
        status: 'active',
      })

    if (profileError) {
      // Check if the error is from the SQL trigger (check_employee_limits)
      if (profileError.message.includes('Limite de')) {
        await cleanupOrphanedUser('SQL trigger blocked employee creation')
        return NextResponse.json({ error: profileError.message }, { status: 403 })
      }
      await cleanupOrphanedUser(`Profile creation failed: ${profileError.message}`)
      return NextResponse.json(
        { error: `Erreur lors de la création du profil : ${profileError.message}` },
        { status: 500 }
      )
    }

    // ─── Return success with generated password ────────────────
    return NextResponse.json({
      employee: {
        id: userId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone?.trim() || null,
        status: 'active',
      },
      generatedPassword,
    }, { status: 201 })
  } catch (error) {
    console.error('Owner employees POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
