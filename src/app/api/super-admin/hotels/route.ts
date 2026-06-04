import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, error: 'Non authentifié' }
  const role = user.app_metadata?.role
  if (role !== 'super_admin') return { authorized: false, error: 'Accès refusé : rôle super_admin requis' }
  return { authorized: true, userId: user.id }
}

export async function GET() {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { data: hotels, error } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get active subscriptions for each hotel
    const hotelIds = (hotels || []).map((h) => h.id)

    let subscriptionMap: Record<string, {
      plan_name: string
      plan_price: number
      starts_at: string
      ends_at: string
    }> = {}

    if (hotelIds.length > 0) {
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('hotel_id, starts_at, ends_at, status, subscription_plans(name, price_fcfa)')
        .eq('status', 'active')
        .in('hotel_id', hotelIds)

      if (subscriptions) {
        for (const sub of subscriptions) {
          if (!subscriptionMap[sub.hotel_id]) {
            const planData = sub.subscription_plans as unknown as { name: string; price_fcfa: number } | null
            subscriptionMap[sub.hotel_id] = {
              plan_name: planData?.name || '—',
              plan_price: planData?.price_fcfa || 0,
              starts_at: sub.starts_at,
              ends_at: sub.ends_at,
            }
          }
        }
      }
    }

    const formattedHotels = (hotels || []).map((hotel) => {
      const sub = subscriptionMap[hotel.id]
      return {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        phone: hotel.phone,
        plan_name: sub?.plan_name || null,
        plan_price: sub?.plan_price || null,
        subscription_start: sub?.starts_at || null,
        subscription_end: sub?.ends_at || null,
        status: hotel.status,
      }
    })

    return NextResponse.json({ hotels: formattedHotels })
  } catch (error) {
    console.error('Error fetching hotels:', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des hôtels' },
      { status: 500 }
    )
  }
}
