import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist']
const WRITE_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/conference-rooms
 * List all conference rooms for the hotel.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!READ_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    const { data: rooms, error } = await adminClient
      .from('conference_rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rooms })
  } catch (error) {
    console.error('Conference rooms GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/conference-rooms
 * Create a new conference room.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent créer des salles de conférence.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { name, capacity, price_per_hour, status } = body

    if (!name || !capacity || !price_per_hour) {
      return NextResponse.json(
        { error: 'Le nom, la capacité et le prix par heure sont requis' },
        { status: 400 }
      )
    }

    const capacityNum = parseInt(capacity)
    if (isNaN(capacityNum) || capacityNum <= 0) {
      return NextResponse.json(
        { error: 'La capacité doit être un nombre positif' },
        { status: 400 }
      )
    }

    const priceNum = parseFloat(price_per_hour)
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: 'Le prix par heure doit être un nombre positif' },
        { status: 400 }
      )
    }

    const validStatuses = ['available', 'occupied', 'maintenance']
    const roomStatus = status && validStatuses.includes(status) ? status : 'available'

    const adminClient = createAdminClient()

    // Check uniqueness: (hotel_id, name)
    const { data: existing } = await adminClient
      .from('conference_rooms')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Une salle de conférence nommée "${name.trim()}" existe déjà` },
        { status: 409 }
      )
    }

    const { data: room, error } = await adminClient
      .from('conference_rooms')
      .insert({
        hotel_id: hotelId,
        name: name.trim(),
        capacity: capacityNum,
        price_per_hour: priceNum,
        status: roomStatus,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Une salle de conférence nommée "${name.trim()}" existe déjà` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room }, { status: 201 })
  } catch (error) {
    console.error('Conference rooms POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
