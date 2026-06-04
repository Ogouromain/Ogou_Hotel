import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/owner/employees/[id]
 * Update an employee's role, phone, or status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()

    // Verify employee belongs to this hotel
    const { data: existingEmployee } = await adminClient
      .from('profiles')
      .select('id, role, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    // Cannot modify the owner's own profile through this endpoint
    if (existingEmployee.role === 'owner') {
      return NextResponse.json({ error: 'Impossible de modifier le profil du propriétaire' }, { status: 403 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.role !== undefined) {
      const validRoles = ['manager', 'receptionist', 'restaurant_staff', 'housekeeper']
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
      }

      // ─── LIMIT CHECK if changing role ─────────────────────
      if (body.role !== existingEmployee.role) {
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
          if (body.role === 'receptionist') {
            const { count } = await adminClient
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('hotel_id', hotelId)
              .eq('role', 'receptionist')
              .eq('status', 'active')

            if ((count ?? 0) >= planLimits.max_receptionists) {
              return NextResponse.json(
                { error: `Limite de réceptionnistes atteinte (${planLimits.max_receptionists} max)` },
                { status: 403 }
              )
            }
          }

          if (body.role === 'manager') {
            const { count } = await adminClient
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('hotel_id', hotelId)
              .eq('role', 'manager')
              .eq('status', 'active')

            if ((count ?? 0) >= planLimits.max_managers) {
              return NextResponse.json(
                { error: `Limite de managers atteinte (${planLimits.max_managers} max)` },
                { status: 403 }
              )
            }
          }
        }
      }

      updateData.role = body.role
    }

    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null
    if (body.status !== undefined) {
      const validStatuses = ['active', 'suspended']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      updateData.status = body.status
    }
    if (body.first_name !== undefined) updateData.first_name = body.first_name.trim()
    if (body.last_name !== undefined) updateData.last_name = body.last_name.trim()

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: employee, error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select('id, first_name, last_name, role, phone, status')
      .single()

    if (error) {
      if (error.message.includes('Limite de')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Owner employees PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/employees/[id]
 * Remove an employee from the hotel (deactivate profile + optionally delete auth user).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const adminClient = createAdminClient()

    // Verify employee belongs to this hotel
    const { data: existingEmployee } = await adminClient
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    // Cannot delete the owner
    if (existingEmployee.role === 'owner') {
      return NextResponse.json({ error: 'Impossible de supprimer le propriétaire' }, { status: 403 })
    }

    // Cannot delete yourself
    if (id === user.id) {
      return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 403 })
    }

    // Delete the profile (cascade will handle auth user via ON DELETE CASCADE)
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Also delete the auth user
    try {
      await adminClient.auth.admin.deleteUser(id)
    } catch (e) {
      console.error('Failed to delete auth user (profile already deleted):', e)
      // Profile is already deleted, auth user orphan is non-critical
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner employees DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
