/**
 * Demo mode data for OGOU_Hôtel
 * 
 * When Supabase is not configured (no env vars), the app runs in demo mode
 * with in-memory mock data. This allows testing the workflow without a database.
 */

// ─── Demo mode detection ────────────────────────────────────
export function isDemoMode(): boolean {
  // Demo mode is active when Supabase credentials are not configured
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY
}

// ─── Room type ──────────────────────────────────────────────
export interface DemoRoom {
  id: string
  hotel_id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance'
  updated_at: string
}

// ─── In-memory demo rooms ───────────────────────────────────
const DEMO_HOTEL_ID = 'demo-hotel-0001'

export const DEMO_ROOMS: DemoRoom[] = [
  { id: 'room-001', hotel_id: DEMO_HOTEL_ID, room_number: '101', room_type: 'Single', price_per_night: 15000, status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-002', hotel_id: DEMO_HOTEL_ID, room_number: '102', room_type: 'Single', price_per_night: 15000, status: 'occupied', updated_at: new Date().toISOString() },
  { id: 'room-003', hotel_id: DEMO_HOTEL_ID, room_number: '103', room_type: 'Double', price_per_night: 25000, status: 'cleaning', updated_at: new Date().toISOString() },
  { id: 'room-004', hotel_id: DEMO_HOTEL_ID, room_number: '104', room_type: 'Double', price_per_night: 25000, status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-005', hotel_id: DEMO_HOTEL_ID, room_number: '201', room_type: 'Suite', price_per_night: 50000, status: 'occupied', updated_at: new Date().toISOString() },
  { id: 'room-006', hotel_id: DEMO_HOTEL_ID, room_number: '202', room_type: 'Double', price_per_night: 25000, status: 'cleaning', updated_at: new Date().toISOString() },
  { id: 'room-007', hotel_id: DEMO_HOTEL_ID, room_number: '203', room_type: 'Single', price_per_night: 15000, status: 'maintenance', updated_at: new Date().toISOString() },
  { id: 'room-008', hotel_id: DEMO_HOTEL_ID, room_number: '204', room_type: 'Suite', price_per_night: 50000, status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-009', hotel_id: DEMO_HOTEL_ID, room_number: '301', room_type: 'Double', price_per_night: 25000, status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-010', hotel_id: DEMO_HOTEL_ID, room_number: '302', room_type: 'Single', price_per_night: 15000, status: 'occupied', updated_at: new Date().toISOString() },
]

// ─── Update demo room status ────────────────────────────────
export function updateDemoRoomStatus(id: string, newStatus: string): DemoRoom {
  const room = DEMO_ROOMS.find(r => r.id === id)
  if (!room) {
    throw new Error(`Chambre ${id} introuvable`)
  }
  room.status = newStatus as DemoRoom['status']
  room.updated_at = new Date().toISOString()
  return { ...room }
}
