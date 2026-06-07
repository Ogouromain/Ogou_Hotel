import { NextRequest, NextResponse } from 'next/server'
import { INIT_SQL_SCRIPT } from '@/lib/sql-script'
import { validateSetupKey } from '@/lib/setup-auth'

export async function GET(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError
  return NextResponse.json({ sql: INIT_SQL_SCRIPT })
}
