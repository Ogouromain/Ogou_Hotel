import { NextResponse } from 'next/server'
import { INIT_SQL_SCRIPT } from '@/lib/sql-script'

export async function GET() {
  return NextResponse.json({ sql: INIT_SQL_SCRIPT })
}
