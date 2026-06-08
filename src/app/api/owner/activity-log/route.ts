import { NextRequest, NextResponse } from 'next/server'
import { createClientWithCookies } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

interface AuditLogRow {
  id: string
  hotel_id: string
  profile_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  profiles: {
    first_name: string | null
    last_name: string | null
    role: string | null
  } | null
}

interface EmployeeActionRow {
  profile_id: string
  first_name: string | null
  last_name: string | null
  role: string | null
  action: string
  count: number
}

// ─── Role Access ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['owner', 'manager']

// ─── GET /api/owner/activity-log ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate via cookie-based session.
    //    Read cookies directly from the middleware-modified request to avoid
    //    issues where cookies() from next/headers may not see the refreshed
    //    session cookies set by the middleware's setAll() callback.
    const supabase = createClientWithCookies({
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        // Cookie persistence is handled by the middleware;
        // no-op here to avoid interfering with the response.
      },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json(
        { error: 'Aucun hôtel associé à ce compte' },
        { status: 404 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Service admin non configuré' },
        { status: 500 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const summaryMode = searchParams.get('summary') === 'true'

    const actionFilter = searchParams.get('action')
    const entityTypeFilter = searchParams.get('entity_type')
    const profileIdFilter = searchParams.get('profile_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(rawLimit, 1), 200)
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10)
    const offset = Math.max(rawOffset, 0)

    // 3. Branch: summary vs regular log query
    if (summaryMode) {
      return await handleSummaryQuery(
        adminClient,
        hotelId,
        { actionFilter, entityTypeFilter, profileIdFilter, dateFrom, dateTo }
      )
    }

    return await handleLogQuery(
      adminClient,
      hotelId,
      { actionFilter, entityTypeFilter, profileIdFilter, dateFrom, dateTo, limit, offset }
    )
  } catch (error) {
    console.error('Owner activity-log GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── Regular Log Query ──────────────────────────────────────────────────────────

async function handleLogQuery(
  adminClient: AdminClient,
  hotelId: string,
  filters: {
    actionFilter: string | null
    entityTypeFilter: string | null
    profileIdFilter: string | null
    dateFrom: string | null
    dateTo: string | null
    limit: number
    offset: number
  }
) {
  // Build base query
  let query = adminClient
    .from('audit_logs')
    .select(
      'id, hotel_id, profile_id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(first_name, last_name, role)',
      { count: 'exact' }
    )
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  // Apply filters
  if (filters.actionFilter) {
    query = query.eq('action', filters.actionFilter)
  }
  if (filters.entityTypeFilter) {
    query = query.eq('entity_type', filters.entityTypeFilter)
  }
  if (filters.profileIdFilter) {
    query = query.eq('profile_id', filters.profileIdFilter)
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    // Add one day to include the entire end date
    const toDate = new Date(filters.dateTo)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString())
  }

  const { data, count, error } = await query

  if (error) {
    console.error('Activity log query error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des logs' }, { status: 500 })
  }

  const logs = (data as AuditLogRow[] | null)?.map((row) => ({
    id: row.id,
    hotel_id: row.hotel_id,
    profile_id: row.profile_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_values: row.old_values,
    new_values: row.new_values,
    created_at: row.created_at,
    profiles: row.profiles
      ? {
          first_name: row.profiles.first_name ?? '',
          last_name: row.profiles.last_name ?? '',
          role: row.profiles.role ?? '',
        }
      : {
          first_name: '',
          last_name: '',
          role: '',
        },
  })) ?? []

  return NextResponse.json({
    logs,
    total: count ?? 0,
    limit: filters.limit,
    offset: filters.offset,
  })
}

// ─── Summary Query ──────────────────────────────────────────────────────────────

async function handleSummaryQuery(
  adminClient: AdminClient,
  hotelId: string,
  filters: {
    actionFilter: string | null
    entityTypeFilter: string | null
    profileIdFilter: string | null
    dateFrom: string | null
    dateTo: string | null
  }
) {
  // Build base query — fetch all matching logs (no pagination for summary)
  let query = adminClient
    .from('audit_logs')
    .select('profile_id, action, profiles(first_name, last_name, role)')
    .eq('hotel_id', hotelId)

  // Apply the same filters
  if (filters.actionFilter) {
    query = query.eq('action', filters.actionFilter)
  }
  if (filters.entityTypeFilter) {
    query = query.eq('entity_type', filters.entityTypeFilter)
  }
  if (filters.profileIdFilter) {
    query = query.eq('profile_id', filters.profileIdFilter)
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('Activity log summary query error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du résumé' },
      { status: 500 }
    )
  }

  const rows = data as EmployeeActionRow[] | null ?? []
  const totalActions = rows.length

  // ─── Actions breakdown by type ─────────────────────────────────────────────
  const actionsByType: Record<string, number> = {}
  for (const row of rows) {
    const key = row.action
    actionsByType[key] = (actionsByType[key] || 0) + 1
  }

  // ─── Per-employee aggregation ──────────────────────────────────────────────
  const employeeMap = new Map<
    string,
    {
      profile_id: string
      first_name: string
      last_name: string
      role: string
      action_count: number
      actions_breakdown: Record<string, number>
    }
  >()

  for (const row of rows) {
    const pid = row.profile_id
    if (!employeeMap.has(pid)) {
      const profile = row.profiles as { first_name: string | null; last_name: string | null; role: string | null } | null
      employeeMap.set(pid, {
        profile_id: pid,
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        role: profile?.role ?? '',
        action_count: 0,
        actions_breakdown: {},
      })
    }

    const employee = employeeMap.get(pid)!
    employee.action_count += 1
    employee.actions_breakdown[row.action] =
      (employee.actions_breakdown[row.action] || 0) + 1
  }

  // Sort employees by action_count descending (most active first)
  const employees = Array.from(employeeMap.values()).sort(
    (a, b) => b.action_count - a.action_count
  )

  // ─── Date range for response ──────────────────────────────────────────────
  const dateRange = {
    from: filters.dateFrom || null,
    to: filters.dateTo || null,
  }

  return NextResponse.json({
    summary: {
      total_actions: totalActions,
      actions_by_type: actionsByType,
      employees,
    },
    date_range: dateRange,
  })
}
