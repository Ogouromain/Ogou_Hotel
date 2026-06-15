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

// ─── Demo reservation type ──────────────────────────────────
export interface DemoReservation {
  id: string
  hotel_id: string
  customer_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  total_price: number
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  customers: { first_name: string; last_name: string; phone: string | null; email?: string | null }
  rooms: { id: string; room_number: string; room_type: string; price_per_night: number; status: string }
  created_at: string
  updated_at: string
}

// ─── In-memory demo reservations ────────────────────────────
export const DEMO_RESERVATIONS: DemoReservation[] = [
  // A checked-in reservation (room 102 - occupied) — can be checked out
  {
    id: 'res-001',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-001',
    room_id: 'room-002',
    check_in_date: '2025-01-10',
    check_out_date: '2025-03-15',
    total_price: 75000,
    status: 'checked_in',
    customers: { first_name: 'Amadou', last_name: 'Koné', phone: '+225 07 08 09 10', email: 'amadou.kone@email.com' },
    rooms: { id: 'room-002', room_number: '102', room_type: 'Single', price_per_night: 15000, status: 'occupied' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // A checked-in reservation (room 201 - occupied) — past checkout date (expired stay)
  {
    id: 'res-002',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-002',
    room_id: 'room-005',
    check_in_date: '2025-01-05',
    check_out_date: '2025-01-08',
    total_price: 150000,
    status: 'checked_in',
    customers: { first_name: 'Fatou', last_name: 'Diallo', phone: '+225 05 06 07 08', email: 'fatou.diallo@email.com' },
    rooms: { id: 'room-005', room_number: '201', room_type: 'Suite', price_per_night: 50000, status: 'occupied' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // A checked-in reservation (room 302 - occupied)
  {
    id: 'res-003',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-003',
    room_id: 'room-010',
    check_in_date: '2025-01-12',
    check_out_date: '2025-03-18',
    total_price: 90000,
    status: 'checked_in',
    customers: { first_name: 'Moussa', last_name: 'Touré', phone: '+225 01 02 03 04', email: 'moussa.toure@email.com' },
    rooms: { id: 'room-010', room_number: '302', room_type: 'Single', price_per_night: 15000, status: 'occupied' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // A confirmed reservation — today's check-in
  {
    id: 'res-004',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-004',
    room_id: 'room-001',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0]; })(),
    total_price: 45000,
    status: 'confirmed',
    customers: { first_name: 'Aïssata', last_name: 'Coulibaly', phone: '+225 11 12 13 14', email: 'aissata.c@email.com' },
    rooms: { id: 'room-001', room_number: '101', room_type: 'Single', price_per_night: 15000, status: 'available' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // A pending reservation — today's check-in
  {
    id: 'res-005',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-005',
    room_id: 'room-004',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().split('T')[0]; })(),
    total_price: 125000,
    status: 'pending',
    customers: { first_name: 'Ibrahim', last_name: 'Sangaré', phone: '+225 15 16 17 18', email: 'ibrahim.s@email.com' },
    rooms: { id: 'room-004', room_number: '104', room_type: 'Double', price_per_night: 25000, status: 'available' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // A checked-out reservation (already left)
  {
    id: 'res-006',
    hotel_id: DEMO_HOTEL_ID,
    customer_id: 'cust-006',
    room_id: 'room-003',
    check_in_date: '2025-01-01',
    check_out_date: '2025-01-05',
    total_price: 100000,
    status: 'checked_out',
    customers: { first_name: 'Koffi', last_name: 'Yao', phone: '+225 19 20 21 22', email: 'koffi.yao@email.com' },
    rooms: { id: 'room-003', room_number: '103', room_type: 'Double', price_per_night: 25000, status: 'cleaning' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
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

// ─── Update demo reservation status ─────────────────────────
export function updateDemoReservationStatus(id: string, newStatus: string): DemoReservation | null {
  const res = DEMO_RESERVATIONS.find(r => r.id === id)
  if (!res) return null
  res.status = newStatus as DemoReservation['status']
  res.updated_at = new Date().toISOString()
  // Also update the room status in DEMO_ROOMS
  if (newStatus === 'checked_out') {
    const room = DEMO_ROOMS.find(r => r.id === res.room_id)
    if (room) {
      room.status = 'cleaning'
      room.updated_at = new Date().toISOString()
    }
    // Update the reservation's room status too
    res.rooms.status = 'cleaning'
  }
  if (newStatus === 'checked_in') {
    const room = DEMO_ROOMS.find(r => r.id === res.room_id)
    if (room) {
      room.status = 'occupied'
      room.updated_at = new Date().toISOString()
    }
    res.rooms.status = 'occupied'
  }
  return { ...res }
}
