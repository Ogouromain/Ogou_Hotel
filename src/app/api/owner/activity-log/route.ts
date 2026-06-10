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
}

interface ProfileRow {
  id: string
  first_name: string | null
  last_name: string | null
  role: string | null
}

// ─── Role Access ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['owner', 'manager']

// ─── Helper: Fetch profiles for given IDs ──────────────────────────────────────

async function fetchProfiles(
  adminClient: AdminClient,
  profileIds: string[]
): Promise<Map<string, ProfileRow>> {
  const profileMap = new Map<string, ProfileRow>()

  if (profileIds.length === 0) return profileMap

  // Fetch profiles in batches of 100 to avoid URL length limits
  const BATCH_SIZE = 100
  for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
    const batch = profileIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', batch)

    if (error) {
      console.error('Profile fetch error:', error)
      continue
    }

    if (data) {
      for (const profile of data as ProfileRow[]) {
        profileMap.set(profile.id, profile)
      }
    }
  }

  return profileMap
}

// ─── GET /api/owner/activity-log ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate via cookie-based session.
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

// ─── Apply filters to query ────────────────────────────────────────────────────

function applyFilters(query: any, filters: {
    actionFilter: string | null
    entityTypeFilter: string | null
    profileIdFilter: string | null
    dateFrom: string | null
    dateTo: string | null
  }
) {
  let q = query
  if (filters.actionFilter && filters.actionFilter !== 'all') {
    q = q.eq('action', filters.actionFilter)
  }
  if (filters.entityTypeFilter) {
    q = q.eq('entity_type', filters.entityTypeFilter)
  }
  if (filters.profileIdFilter && filters.profileIdFilter !== 'all') {
    q = q.eq('profile_id', filters.profileIdFilter)
  }
  if (filters.dateFrom) {
    q = q.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    // Add one day to include the entire end date
    const toDate = new Date(filters.dateTo)
    toDate.setDate(toDate.getDate() + 1)
    q = q.lt('created_at', toDate.toISOString())
  }
  return q
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
  // Build base query — no Supabase join (audit_logs.profile_id has no FK to profiles.id)
  let query = adminClient
    .from('audit_logs')
    .select(
      'id, hotel_id, profile_id, action, entity_type, entity_id, old_values, new_values, created_at',
      { count: 'exact' }
    )
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  query = applyFilters(query, filters)

  const { data, count, error } = await query

  if (error) {
    console.error('Activity log query error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des logs' }, { status: 500 })
  }

  const rows = (data as AuditLogRow[] | null) ?? []

  // Fetch profiles separately since there's no FK relationship for Supabase join
  const uniqueProfileIds = [...new Set(rows.map((r) => r.profile_id))]
  const profileMap = await fetchProfiles(adminClient, uniqueProfileIds)

  const logs = rows.map((row) => {
    const profile = profileMap.get(row.profile_id)
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      profile_id: row.profile_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_values: row.old_values,
      new_values: row.new_values,
      created_at: row.created_at,
      profiles: profile
        ? {
            first_name: profile.first_name ?? '',
            last_name: profile.last_name ?? '',
            role: profile.role ?? '',
          }
        : {
            first_name: '',
            last_name: '',
            role: '',
          },
    }
  })

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
  // Build base query — no Supabase join
  let query = adminClient
    .from('audit_logs')
    .select('profile_id, action')
    .eq('hotel_id', hotelId)

  query = applyFilters(query, filters)

  const { data, error } = await query

  if (error) {
    console.error('Activity log summary query error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du résumé' },
      { status: 500 }
    )
  }

  interface SummaryRow {
    profile_id: string
    action: string
  }

  const rows = (data as SummaryRow[] | null) ?? []
  const totalActions = rows.length

  // ─── Actions breakdown by type ─────────────────────────────────────────────
  const actionsByType: Record<string, number> = {}
  for (const row of rows) {
    const key = row.action
    actionsByType[key] = (actionsByType[key] || 0) + 1
  }

  // ─── Per-employee aggregation ──────────────────────────────────────────────
  // Collect unique profile IDs first
  const uniqueProfileIds = [...new Set(rows.map((r) => r.profile_id))]

  // Build employee map with action counts
  const employeeMap = new Map<
    string,
    {
      profile_id: string
      action_count: number
      actions_breakdown: Record<string, number>
    }
  >()

  for (const row of rows) {
    const pid = row.profile_id
    if (!employeeMap.has(pid)) {
      employeeMap.set(pid, {
        profile_id: pid,
        action_count: 0,
        actions_breakdown: {},
      })
    }

    const employee = employeeMap.get(pid)!
    employee.action_count += 1
    employee.actions_breakdown[row.action] =
      (employee.actions_breakdown[row.action] || 0) + 1
  }

  // Fetch profiles separately
  const profileMap = await fetchProfiles(adminClient, uniqueProfileIds)

  // Merge profile data into employees
  const employees = Array.from(employeeMap.values())
    .map((emp) => {
      const profile = profileMap.get(emp.profile_id)
      return {
        profile_id: emp.profile_id,
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        role: profile?.role ?? '',
        action_count: emp.action_count,
        actions_breakdown: emp.actions_breakdown,
      }
    })
    .sort((a, b) => b.action_count - a.action_count)

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
