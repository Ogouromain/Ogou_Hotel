import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * POST /api/owner/employees/[id]/reset-password
 * Reset an employee's password. Generates a new random password and returns it.
 * Only the hotel owner can reset passwords for their employees.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userRole = user.app_metadata?.role
    if (userRole !== 'owner') {
      return NextResponse.json({ error: 'Accès non autorisé. Seul le propriétaire peut réinitialiser les mots de passe.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify employee belongs to this hotel
    const { data: existingEmployee } = await adminClient
      .from('profiles')
      .select('id, role, first_name, last_name, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    // Cannot reset the owner's password through this endpoint
    if (existingEmployee.role === 'owner') {
      return NextResponse.json(
        { error: 'Impossible de réinitialiser le mot de passe du propriétaire' },
        { status: 403 }
      )
    }

    // Cannot reset own password (use account settings instead)
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Utilisez les paramètres du compte pour votre propre mot de passe' },
        { status: 403 }
      )
    }

    // Generate a new secure random password
    const newPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12)

    // Update the user's password using Supabase Admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Reset password error:', updateError)
      return NextResponse.json(
        { error: `Erreur lors de la réinitialisation : ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: existingEmployee.id,
        first_name: existingEmployee.first_name,
        last_name: existingEmployee.last_name,
      },
      newPassword,
    })
  } catch (error) {
    console.error('Owner employees reset-password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
