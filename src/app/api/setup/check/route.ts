import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Check if hotels table exists by trying to query it
    const { error: hotelsError } = await supabase
      .from('hotels')
      .select('id')
      .limit(1)

    const tablesExist = !hotelsError || hotelsError.code !== 'PGRST205'

    // If tables don't exist, return early
    if (!tablesExist) {
      return NextResponse.json({
        tablesExist: false,
        adminExists: false,
        plansSeeded: false,
        ready: false,
      })
    }

    // Check if subscription_plans are seeded
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('id')
      .limit(1)

    const plansSeeded = !plansError && plans && plans.length > 0

    // Check if super_admin exists
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1)

    const adminExists = !adminError && adminProfile && adminProfile.length > 0

    return NextResponse.json({
      tablesExist: true,
      adminExists,
      plansSeeded,
      ready: tablesExist && plansSeeded && adminExists,
    })
  } catch (error) {
    console.error('Setup check error:', error)
    return NextResponse.json({
      tablesExist: false,
      adminExists: false,
      plansSeeded: false,
      ready: false,
      error: String(error),
    }, { status: 500 })
  }
}
