import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/customers/[id]/history
 * Returns a customer's reservation and invoice history.
 */
export async function GET(
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

    const role = user.app_metadata?.role
    if (!['owner', 'manager', 'receptionist'].includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify customer belongs to this hotel
    const { data: customer } = await adminClient
      .from('customers')
      .select('id, first_name, last_name, phone, email')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Fetch reservations for this customer
    const { data: reservations } = await adminClient
      .from('reservations')
      .select('id, check_in_date, check_out_date, total_price, status, rooms(room_number, room_type)')
      .eq('customer_id', id)
      .eq('hotel_id', hotelId)
      .order('check_in_date', { ascending: false })

    // Fetch invoices for this customer
    const { data: invoices } = await adminClient
      .from('invoices')
      .select('id, invoice_number, total_amount, status, payment_method, created_at')
      .eq('customer_id', id)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    // Compute stats
    const totalReservations = reservations?.length ?? 0
    const completedStays = reservations?.filter((r: { status: string }) => r.status === 'checked_out').length ?? 0
    const totalSpent = invoices?.reduce(
      (sum: number, inv: { total_amount: number }) => sum + (inv.total_amount || 0), 0
    ) ?? 0

    return NextResponse.json({
      customer,
      reservations: reservations || [],
      invoices: invoices || [],
      stats: {
        total_reservations: totalReservations,
        completed_stays: completedStays,
        total_spent: totalSpent,
      },
    })
  } catch (error) {
    console.error('Customer history GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
