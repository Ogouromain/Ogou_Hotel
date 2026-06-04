import { createAdminClient } from '@/lib/supabase/admin'

interface AuditLogParams {
  hotel_id: string
  profile_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
}

/**
 * Log an audit entry for tracking user actions.
 * Uses the admin client to bypass RLS.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const adminClient = createAdminClient()
    await adminClient.from('audit_logs').insert({
      hotel_id: params.hotel_id,
      profile_id: params.profile_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      old_values: params.old_values || null,
      new_values: params.new_values || null,
    })
  } catch (error) {
    console.error('Audit log error:', error)
    // Don't throw — audit logging should never break the main flow
  }
}
