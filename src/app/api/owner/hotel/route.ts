import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/hotel
 * 
 * Returns the hotel and subscription info for the currently authenticated owner.
 * Only accessible by authenticated users with the 'owner' role.
 */
const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_PATCH = ['owner', 'manager']

export async function GET() {
  try {
    // 1. Authenticate the user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_GET.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé à ce compte' }, { status: 404 })
    }

    // 2. Fetch hotel info (admin client bypasses RLS)
    const adminClient = createAdminClient()

    const { data: hotel, error: hotelError } = await adminClient
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single()

    if (hotelError || !hotel) {
      return NextResponse.json(
        { error: 'Hôtel introuvable' },
        { status: 404 }
      )
    }

    // 3. Fetch subscription info
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('id, starts_at, ends_at, status, subscription_plans(id, name, price_fcfa)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let subscriptionInfo = null
    if (subscription) {
      const planData = subscription.subscription_plans as unknown as {
        id: string
        name: string
        price_fcfa: number
      } | null

      subscriptionInfo = {
        id: subscription.id,
        plan_name: planData?.name || 'Inconnu',
        plan_price: planData?.price_fcfa || 0,
        starts_at: subscription.starts_at,
        ends_at: subscription.ends_at,
        status: subscription.status,
      }
    }

    // 4. Fetch profile info
    const { data: profile } = await adminClient
      .from('profiles')
      .select('first_name, last_name, role, phone')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      hotel: {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        address: hotel.address,
        phone: hotel.phone,
        email: hotel.email,
        status: hotel.status,
      },
      subscription: subscriptionInfo,
      profile: profile ? {
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        phone: profile.phone,
      } : null,
    })
  } catch (error) {
    console.error('Owner hotel GET error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des données de l\'hôtel' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/owner/hotel
 * 
 * Update hotel information for the currently authenticated owner.
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_PATCH.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut modifier les informations de l\'hôtel' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé à ce compte' }, { status: 404 })
    }

    const body = await request.json()
    const adminClient = createAdminClient()

    // Build update object (only allow certain fields)
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.city !== undefined) updateData.city = body.city.trim()
    if (body.phone !== undefined) updateData.phone = body.phone.trim()
    if (body.address !== undefined) updateData.address = body.address?.trim() || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: hotel, error } = await adminClient
      .from('hotels')
      .update(updateData)
      .eq('id', hotelId)
      .select('id, name, city, address, phone, email, status')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hotel })
  } catch (error) {
    console.error('Owner hotel PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
