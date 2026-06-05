import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'

// ─── POST /api/leads ─────────────────────────────────────────────────────────
// Public endpoint — no auth required.
// Inserts a new lead into public.leads with status 'new'.
// Realtime trigger (from Step 8) will notify Super Admin dashboard.

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Service non configuré. Veuillez réessayer plus tard.' },
        { status: 503 }
      )
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service non disponible.' },
        { status: 503 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const { prospect_name, hotel_name, prospect_phone, hotel_size_rooms } = body

    if (!prospect_name || typeof prospect_name !== 'string' || prospect_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Le nom du prospect est requis (min. 2 caractères).' },
        { status: 400 }
      )
    }

    if (!hotel_name || typeof hotel_name !== 'string' || hotel_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Le nom de l\'établissement est requis (min. 2 caractères).' },
        { status: 400 }
      )
    }

    if (!prospect_phone || typeof prospect_phone !== 'string' || prospect_phone.trim().length < 8) {
      return NextResponse.json(
        { error: 'Un numéro de téléphone valide est requis (min. 8 chiffres).' },
        { status: 400 }
      )
    }

    const sizeRooms = Number(hotel_size_rooms)
    if (isNaN(sizeRooms) || sizeRooms < 1 || sizeRooms > 10000) {
      return NextResponse.json(
        { error: 'Le nombre de chambres doit être entre 1 et 10 000.' },
        { status: 400 }
      )
    }

    // Extract optional fields — prospect_email is NOT NULL in the DB
    // If not provided, use a placeholder based on phone number
    const prospect_email = body.prospect_email && typeof body.prospect_email === 'string' && body.prospect_email.trim().length > 0
      ? body.prospect_email.trim()
      : `prospect+${prospect_phone.trim()}@hotelci.ci`

    // Combine city with hotel name if provided (city not a separate DB column)
    const city = body.city && typeof body.city === 'string' ? body.city.trim() : ''
    const displayHotelName = city
      ? `${hotel_name.trim()} — ${city}`
      : hotel_name.trim()

    // Insert the lead
    const { data, error } = await supabase
      .from('leads')
      .insert({
        prospect_name: prospect_name.trim(),
        hotel_name: displayHotelName,
        prospect_email,
        prospect_phone: prospect_phone.trim(),
        hotel_size_rooms: sizeRooms,
        status: 'new',
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[/api/leads] Insert error:', error)
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement. Veuillez réessayer.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      lead: data,
      message: 'Votre demande a été enregistrée avec succès ! Notre équipe vous contactera sous 24h.',
    }, { status: 201 })

  } catch (err) {
    console.error('[/api/leads] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    )
  }
}
