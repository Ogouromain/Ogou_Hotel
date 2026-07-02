import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOMS } from '@/lib/demo-data'

// Receptionist can view rooms but not create/modify them
const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_POST = ['owner', 'manager']

/**
 * GET /api/owner/rooms
 * List all rooms for the authenticated owner's hotel.
 */
export async function GET() {
  try {
    // Demo mode: return in-memory rooms
    if (isDemoMode()) {
      const rooms = DEMO_ROOMS.map(r => ({
        id: r.id,
        hotel_id: r.hotel_id,
        room_number: r.room_number,
        room_type: r.room_type,
        price_per_night: r.price_per_night,
        weekend_price: r.weekend_price,
        weekend_days: r.weekend_days,
        status: r.status,
        updated_at: r.updated_at,
      }))
      return NextResponse.json({ rooms })
    }

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
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    const { data: rooms, error } = await adminClient
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('room_number', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rooms })
  } catch (error) {
    console.error('Owner rooms GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/rooms
 * Create a new room for the owner's hotel, with max_rooms limit validation.
 */
export async function POST(request: NextRequest) {
  try {
    // Demo mode: not supported
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Création de chambre non supportée en mode démo' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_POST.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut ajouter des chambres' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { room_number, room_type, price_per_night, weekend_price, weekend_days, status } = body

    if (!room_number || !room_type || !price_per_night) {
      return NextResponse.json(
        { error: 'Numéro de chambre, type et prix par nuit sont requis' },
        { status: 400 }
      )
    }

    const price = parseFloat(price_per_night)
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Le prix par nuit doit être un nombre positif' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // ─── APPLICATION-LEVEL LIMIT CHECK: max_rooms ──────────────
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('id, subscription_plans(max_rooms)')
      .eq('hotel_id', hotelId)
      .eq('status', 'active')
      .maybeSingle()

    const planLimits = subscription?.subscription_plans as unknown as { max_rooms: number } | null

    if (planLimits) {
      const { count } = await adminClient
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)

      if ((count ?? 0) >= planLimits.max_rooms) {
        return NextResponse.json(
          { error: `Limite de chambres atteinte (${planLimits.max_rooms} max) pour votre plan actuel. Mettez à niveau votre abonnement pour ajouter plus de chambres.` },
          { status: 403 }
        )
      }
    }

    // ─── CHECK FOR DUPLICATE ROOM NUMBER ───────────────────────
    const { data: existing } = await adminClient
      .from('rooms')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('room_number', room_number.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `La chambre "${room_number.trim()}" existe déjà` },
        { status: 409 }
      )
    }

    // ─── CREATE THE ROOM ───────────────────────────────────────
    // Préparer les champs de tarification weekend
    const insertData: Record<string, unknown> = {
      hotel_id: hotelId,
      room_number: room_number.trim(),
      room_type: room_type.trim(),
      price_per_night: price,
      status: status || 'available',
    }

    // Prix weekend (optionnel)
    if (weekend_price !== undefined && weekend_price !== null && weekend_price !== '') {
      const wp = parseFloat(weekend_price)
      if (!isNaN(wp) && wp > 0) {
        insertData.weekend_price = wp
      }
    }

    // Jours weekend (optionnel, défaut '5,6')
    if (weekend_days !== undefined && weekend_days !== null && weekend_days !== '') {
      insertData.weekend_days = weekend_days
    }

    const { data: room, error } = await adminClient
      .from('rooms')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Check if the error is from the SQL trigger (check_room_limits)
      if (error.message.includes('Limite de chambres atteinte')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `La chambre "${room_number.trim()}" existe déjà` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room }, { status: 201 })
  } catch (error) {
    console.error('Owner rooms POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
