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
  weekend_price: number | null
  weekend_days: string
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance'
  updated_at: string
}

// ─── Demo hotel type ────────────────────────────────────────
export interface DemoHotel {
  id: string
  name: string
  address: string | null
  city: string
  phone: string
  email: string | null
  status: 'active' | 'suspended' | 'inactive'
  created_at: string
}

// ─── In-memory demo hotels ──────────────────────────────────
const DEMO_HOTEL_ID = 'demo-hotel-0001'

export const DEMO_HOTELS: DemoHotel[] = [
  {
    id: DEMO_HOTEL_ID,
    name: 'Hôtel OGOU Palace',
    address: '12 Boulevard Latrille, Cocody',
    city: 'Abidjan',
    phone: '+225 05 76 10 32 77',
    email: 'contact@ogou-hotel.ci',
    status: 'active',
    created_at: new Date().toISOString(),
  },
]

// ─── Demo customer type ─────────────────────────────────────
export interface DemoCustomer {
  id: string
  hotel_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  identity_document_type: string | null
  identity_document_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── In-memory demo customers ───────────────────────────────
export const DEMO_CUSTOMERS: DemoCustomer[] = [
  { id: 'cust-001', hotel_id: DEMO_HOTEL_ID, first_name: 'Amadou', last_name: 'Koné', email: 'amadou.kone@email.com', phone: '+225 07 08 09 10', identity_document_type: null, identity_document_number: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cust-002', hotel_id: DEMO_HOTEL_ID, first_name: 'Fatou', last_name: 'Diallo', email: 'fatou.diallo@email.com', phone: '+225 05 06 07 08', identity_document_type: null, identity_document_number: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cust-003', hotel_id: DEMO_HOTEL_ID, first_name: 'Moussa', last_name: 'Touré', email: 'moussa.toure@email.com', phone: '+225 01 02 03 04', identity_document_type: null, identity_document_number: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

// ─── In-memory demo rooms ───────────────────────────────────

export const DEMO_ROOMS: DemoRoom[] = [
  { id: 'room-001', hotel_id: DEMO_HOTEL_ID, room_number: '101', room_type: 'Single', price_per_night: 15000, weekend_price: 20000, weekend_days: '5,6', status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-002', hotel_id: DEMO_HOTEL_ID, room_number: '102', room_type: 'Single', price_per_night: 15000, weekend_price: 20000, weekend_days: '5,6', status: 'occupied', updated_at: new Date().toISOString() },
  { id: 'room-003', hotel_id: DEMO_HOTEL_ID, room_number: '103', room_type: 'Double', price_per_night: 25000, weekend_price: 30000, weekend_days: '5,6', status: 'cleaning', updated_at: new Date().toISOString() },
  { id: 'room-004', hotel_id: DEMO_HOTEL_ID, room_number: '104', room_type: 'Double', price_per_night: 25000, weekend_price: null, weekend_days: '5,6', status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-005', hotel_id: DEMO_HOTEL_ID, room_number: '201', room_type: 'Suite', price_per_night: 50000, weekend_price: 65000, weekend_days: '5,6', status: 'occupied', updated_at: new Date().toISOString() },
  { id: 'room-006', hotel_id: DEMO_HOTEL_ID, room_number: '202', room_type: 'Double', price_per_night: 25000, weekend_price: null, weekend_days: '5,6', status: 'cleaning', updated_at: new Date().toISOString() },
  { id: 'room-007', hotel_id: DEMO_HOTEL_ID, room_number: '203', room_type: 'Single', price_per_night: 15000, weekend_price: null, weekend_days: '5,6', status: 'maintenance', updated_at: new Date().toISOString() },
  { id: 'room-008', hotel_id: DEMO_HOTEL_ID, room_number: '204', room_type: 'Suite', price_per_night: 50000, weekend_price: 65000, weekend_days: '5,6', status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-009', hotel_id: DEMO_HOTEL_ID, room_number: '301', room_type: 'Double', price_per_night: 25000, weekend_price: 30000, weekend_days: '5,6', status: 'available', updated_at: new Date().toISOString() },
  { id: 'room-010', hotel_id: DEMO_HOTEL_ID, room_number: '302', room_type: 'Single', price_per_night: 15000, weekend_price: null, weekend_days: '5,6', status: 'occupied', updated_at: new Date().toISOString() },
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

// ─── Demo room rate type (Tarifs Saisonniers) ──────────────
export interface DemoRoomRate {
  id: string
  hotel_id: string
  room_id: string
  name: string
  price_per_night: number
  start_date: string
  end_date: string
  priority: number
  created_at: string
}

// ─── In-memory demo room rates ───────────────────────────────
export const DEMO_ROOM_RATES: DemoRoomRate[] = [
  // Saison Haute for Suite rooms
  { id: 'rate-001', hotel_id: DEMO_HOTEL_ID, room_id: 'room-005', name: 'Saison Haute', price_per_night: 75000, start_date: '2025-07-01', end_date: '2025-08-31', priority: 10, created_at: new Date().toISOString() },
  { id: 'rate-002', hotel_id: DEMO_HOTEL_ID, room_id: 'room-008', name: 'Saison Haute', price_per_night: 75000, start_date: '2025-07-01', end_date: '2025-08-31', priority: 10, created_at: new Date().toISOString() },
  // Fêtes (Christmas/New Year) for Double rooms
  { id: 'rate-003', hotel_id: DEMO_HOTEL_ID, room_id: 'room-003', name: 'Fêtes de Fin d\'Année', price_per_night: 35000, start_date: '2025-12-20', end_date: '2026-01-05', priority: 20, created_at: new Date().toISOString() },
  { id: 'rate-004', hotel_id: DEMO_HOTEL_ID, room_id: 'room-004', name: 'Fêtes de Fin d\'Année', price_per_night: 35000, start_date: '2025-12-20', end_date: '2026-01-05', priority: 20, created_at: new Date().toISOString() },
  // Pâques (Easter) for Single rooms
  { id: 'rate-005', hotel_id: DEMO_HOTEL_ID, room_id: 'room-001', name: 'Pâques', price_per_night: 18000, start_date: '2025-04-14', end_date: '2025-04-21', priority: 5, created_at: new Date().toISOString() },
]

// ─── Demo housekeeping task type (Tâches de Ménage) ────────
export interface DemoHousekeepingTask {
  id: string
  hotel_id: string
  room_id: string
  assigned_to: string | null
  task_type: 'checkout_cleaning' | 'deep_cleaning' | 'maintenance_cleaning' | 'inspection'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  notes: string | null
  due_date: string
  completed_at: string | null
  created_at: string
  // Joined data
  rooms?: { id: string; room_number: string; room_type: string; status: string }
  profiles?: { id: string; first_name: string; last_name: string } | null
}

// ─── In-memory demo housekeeping tasks ───────────────────────
export const DEMO_HOUSEKEEPING_TASKS: DemoHousekeepingTask[] = [
  // Room 103 — checkout cleaning (room is in "cleaning" status)
  {
    id: 'htask-001',
    hotel_id: DEMO_HOTEL_ID,
    room_id: 'room-003',
    assigned_to: null,
    task_type: 'checkout_cleaning',
    priority: 'high',
    status: 'pending',
    notes: 'Client parti ce matin — changement de draps requis',
    due_date: new Date().toISOString().split('T')[0],
    completed_at: null,
    created_at: new Date().toISOString(),
    rooms: { id: 'room-003', room_number: '103', room_type: 'Double', status: 'cleaning' },
    profiles: null,
  },
  // Room 202 — checkout cleaning (room is in "cleaning" status)
  {
    id: 'htask-002',
    hotel_id: DEMO_HOTEL_ID,
    room_id: 'room-006',
    assigned_to: null,
    task_type: 'checkout_cleaning',
    priority: 'normal',
    status: 'pending',
    notes: null,
    due_date: new Date().toISOString().split('T')[0],
    completed_at: null,
    created_at: new Date().toISOString(),
    rooms: { id: 'room-006', room_number: '202', room_type: 'Double', status: 'cleaning' },
    profiles: null,
  },
  // Room 101 — inspection task
  {
    id: 'htask-003',
    hotel_id: DEMO_HOTEL_ID,
    room_id: 'room-001',
    assigned_to: null,
    task_type: 'inspection',
    priority: 'low',
    status: 'pending',
    notes: 'Vérification hebdomadaire',
    due_date: new Date().toISOString().split('T')[0],
    completed_at: null,
    created_at: new Date().toISOString(),
    rooms: { id: 'room-001', room_number: '101', room_type: 'Single', status: 'available' },
    profiles: null,
  },
  // Room 201 — deep cleaning (Suite)
  {
    id: 'htask-004',
    hotel_id: DEMO_HOTEL_ID,
    room_id: 'room-005',
    assigned_to: null,
    task_type: 'deep_cleaning',
    priority: 'normal',
    status: 'pending',
    notes: 'Grand nettoyage mensuel de la suite',
    due_date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })(),
    completed_at: null,
    created_at: new Date().toISOString(),
    rooms: { id: 'room-005', room_number: '201', room_type: 'Suite', status: 'occupied' },
    profiles: null,
  },
  // Room 203 — maintenance cleaning after repair
  {
    id: 'htask-005',
    hotel_id: DEMO_HOTEL_ID,
    room_id: 'room-007',
    assigned_to: null,
    task_type: 'maintenance_cleaning',
    priority: 'normal',
    status: 'pending',
    notes: 'Nettoyage après réparation plomberie',
    due_date: new Date().toISOString().split('T')[0],
    completed_at: null,
    created_at: new Date().toISOString(),
    rooms: { id: 'room-007', room_number: '203', room_type: 'Single', status: 'maintenance' },
    profiles: null,
  },
]

// ─── Demo conference room type (Salles de Conférence) ───────
export interface DemoConferenceRoom {
  id: string
  hotel_id: string
  name: string
  capacity: number
  price_per_hour: number
  status: 'available' | 'occupied' | 'maintenance'
  created_at: string
  updated_at: string
}

// ─── In-memory demo conference rooms ─────────────────────────
export const DEMO_CONFERENCE_ROOMS: DemoConferenceRoom[] = [
  {
    id: 'conf-room-001',
    hotel_id: DEMO_HOTEL_ID,
    name: 'Salle Ébène',
    capacity: 50,
    price_per_hour: 25000,
    status: 'available',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'conf-room-002',
    hotel_id: DEMO_HOTEL_ID,
    name: 'Salle Baobab',
    capacity: 120,
    price_per_hour: 50000,
    status: 'available',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'conf-room-003',
    hotel_id: DEMO_HOTEL_ID,
    name: 'Salle Teranga',
    capacity: 30,
    price_per_hour: 15000,
    status: 'available',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// ─── Demo conference booking type (Réservations de Salles) ──
export interface DemoConferenceBooking {
  id: string
  hotel_id: string
  conference_room_id: string
  customer_id: string
  start_time: string
  end_time: string
  total_price: number
  status: 'confirmed' | 'cancelled' | 'completed'
  // Champs planification événement
  event_name: string | null
  event_type: string | null
  attendees_count: number | null
  catering_required: boolean
  equipment_needs: string | null
  setup_notes: string | null
  contact_name: string | null
  contact_phone: string | null
  created_at: string
  updated_at: string
  // Données jointes (ajoutées lors du GET)
  conference_room_name?: string | null
  customer_name?: string | null
}

// ─── In-memory demo conference bookings ──────────────────────
const _today = new Date()
const _todayStr = _today.toISOString().split('T')[0]
const _tomorrow = new Date(_today); _tomorrow.setDate(_tomorrow.getDate() + 1)
const _tomorrowStr = _tomorrow.toISOString().split('T')[0]
const _nextWeek = new Date(_today); _nextWeek.setDate(_nextWeek.getDate() + 5)
const _nextWeekStr = _nextWeek.toISOString().split('T')[0]
const _yesterday = new Date(_today); _yesterday.setDate(_yesterday.getDate() - 1)
const _yesterdayStr = _yesterday.toISOString().split('T')[0]
const _twoDaysAgo = new Date(_today); _twoDaysAgo.setDate(_twoDaysAgo.getDate() - 2)
const _twoDaysAgoStr = _twoDaysAgo.toISOString().split('T')[0]

export const DEMO_CONFERENCE_BOOKINGS: DemoConferenceBooking[] = [
  // Séminaire d'entreprise aujourd'hui — Salle Ébène
  {
    id: 'conf-book-001',
    hotel_id: DEMO_HOTEL_ID,
    conference_room_id: 'conf-room-001',
    customer_id: 'cust-001',
    start_time: `${_todayStr}T09:00:00Z`,
    end_time: `${_todayStr}T17:00:00Z`,
    total_price: 200000,
    status: 'confirmed',
    event_name: 'Séminaire Annuel MTN',
    event_type: 'seminar',
    attendees_count: 45,
    catering_required: true,
    equipment_needs: 'projector,microphone,screen,wifi',
    setup_notes: 'Configuration en U avec podium. Café d\'accueil à 8h30.',
    contact_name: 'Aminata Koné',
    contact_phone: '+225 07 08 09 10',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Atelier demain — Salle Teranga
  {
    id: 'conf-book-002',
    hotel_id: DEMO_HOTEL_ID,
    conference_room_id: 'conf-room-003',
    customer_id: 'cust-002',
    start_time: `${_tomorrowStr}T10:00:00Z`,
    end_time: `${_tomorrowStr}T13:00:00Z`,
    total_price: 45000,
    status: 'confirmed',
    event_name: 'Atelier Digital Marketing',
    event_type: 'workshop',
    attendees_count: 25,
    catering_required: false,
    equipment_needs: 'projector,wifi',
    setup_notes: 'Configuration îlots de 5 personnes. Paperboard nécessaire.',
    contact_name: 'Fatou Diallo',
    contact_phone: '+225 05 06 07 08',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Conférence semaine prochaine — Salle Baobab
  {
    id: 'conf-book-003',
    hotel_id: DEMO_HOTEL_ID,
    conference_room_id: 'conf-room-002',
    customer_id: 'cust-003',
    start_time: `${_nextWeekStr}T08:00:00Z`,
    end_time: `${_nextWeekStr}T18:00:00Z`,
    total_price: 500000,
    status: 'confirmed',
    event_name: 'Conférence Internationale Afrique Tech',
    event_type: 'conference',
    attendees_count: 100,
    catering_required: true,
    equipment_needs: 'projector,microphone,screen,sound_system,wifi',
    setup_notes: 'Configuration théâtre. Sonorisation complète. Buffet midi et pause café 10h/15h.',
    contact_name: 'Moussa Touré',
    contact_phone: '+225 01 02 03 04',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Réunion d'entreprise hier — terminée
  {
    id: 'conf-book-004',
    hotel_id: DEMO_HOTEL_ID,
    conference_room_id: 'conf-room-001',
    customer_id: 'cust-001',
    start_time: `${_yesterdayStr}T14:00:00Z`,
    end_time: `${_yesterdayStr}T18:00:00Z`,
    total_price: 100000,
    status: 'completed',
    event_name: 'Réunion Trimetrielle Direction',
    event_type: 'corporate_meeting',
    attendees_count: 20,
    catering_required: true,
    equipment_needs: 'projector,wifi',
    setup_notes: null,
    contact_name: 'Amadou Koné',
    contact_phone: '+225 07 08 09 10',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Anniversaire annulé — il y a 2 jours
  {
    id: 'conf-book-005',
    hotel_id: DEMO_HOTEL_ID,
    conference_room_id: 'conf-room-003',
    customer_id: 'cust-002',
    start_time: `${_twoDaysAgoStr}T18:00:00Z`,
    end_time: `${_twoDaysAgoStr}T23:00:00Z`,
    total_price: 75000,
    status: 'cancelled',
    event_name: 'Anniversaire Entreprise CIE',
    event_type: 'birthday',
    attendees_count: 30,
    catering_required: true,
    equipment_needs: 'sound_system',
    setup_notes: 'Décoration festive requise.',
    contact_name: 'Fatou Diallo',
    contact_phone: '+225 05 06 07 08',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// ─── Demo invoice type ──────────────────────────────────────
export interface DemoInvoice {
  id: string
  hotel_id: string
  invoice_number: string
  reservation_id: string | null
  customer_id: string
  subtotal: number
  tourist_tax: number
  vat: number
  total_amount: number
  payment_method: string
  status: 'paid' | 'pending' | 'refund' | 'cancelled'
  receipt_number: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  customers?: { first_name: string; last_name: string; phone: string | null; email?: string | null } | null
  reservations?: { id: string; check_in_date: string; check_out_date: string; rooms?: { id: string; room_number: string; room_type: string } | null } | null
  invoice_items?: DemoInvoiceItem[]
}

export interface DemoInvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

// ─── In-memory demo invoices ────────────────────────────────
let _demoInvoiceCounter = 3
export const DEMO_INVOICES: DemoInvoice[] = [
  {
    id: 'inv-001',
    hotel_id: DEMO_HOTEL_ID,
    invoice_number: 'FACT-2025-01-0001',
    reservation_id: 'res-001',
    customer_id: 'cust-001',
    subtotal: 63559,
    tourist_tax: 0,
    vat: 11441,
    total_amount: 75000,
    payment_method: 'Espèces',
    status: 'paid',
    receipt_number: 'REC-2025-01-0001',
    paid_at: new Date().toISOString(),
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customers: { first_name: 'Amadou', last_name: 'Koné', phone: '+225 07 08 09 10', email: 'amadou.kone@email.com' },
    reservations: { id: 'res-001', check_in_date: '2025-01-10', check_out_date: '2025-03-15', rooms: { id: 'room-002', room_number: '102', room_type: 'Single' } },
    invoice_items: [
      { id: 'item-001', invoice_id: 'inv-001', description: 'Chambre 102 (Single) — Nuitée', quantity: 5, unit_price: 15000, total: 75000 },
    ],
  },
  {
    id: 'inv-002',
    hotel_id: DEMO_HOTEL_ID,
    invoice_number: 'FACT-2025-01-0002',
    reservation_id: 'res-002',
    customer_id: 'cust-002',
    subtotal: 127119,
    tourist_tax: 0,
    vat: 22881,
    total_amount: 150000,
    payment_method: 'OM',
    status: 'paid',
    receipt_number: 'REC-2025-01-0002',
    paid_at: new Date().toISOString(),
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customers: { first_name: 'Fatou', last_name: 'Diallo', phone: '+225 05 06 07 08', email: 'fatou.diallo@email.com' },
    reservations: { id: 'res-002', check_in_date: '2025-01-05', check_out_date: '2025-01-08', rooms: { id: 'room-005', room_number: '201', room_type: 'Suite' } },
    invoice_items: [
      { id: 'item-002', invoice_id: 'inv-002', description: 'Chambre 201 (Suite) — Nuitée', quantity: 3, unit_price: 50000, total: 150000 },
    ],
  },
  {
    id: 'inv-003',
    hotel_id: DEMO_HOTEL_ID,
    invoice_number: 'FACT-2025-01-0003',
    reservation_id: null,
    customer_id: 'cust-003',
    subtotal: 76271,
    tourist_tax: 0,
    vat: 13729,
    total_amount: 90000,
    payment_method: 'Wave',
    status: 'pending',
    receipt_number: null,
    paid_at: null,
    notes: 'En attente de paiement',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customers: { first_name: 'Moussa', last_name: 'Touré', phone: '+225 01 02 03 04', email: 'moussa.toure@email.com' },
    reservations: null,
    invoice_items: [
      { id: 'item-003', invoice_id: 'inv-003', description: 'Services divers', quantity: 1, unit_price: 90000, total: 90000 },
    ],
  },
]

// ─── Auto-generate invoice from reservation (demo mode) ────
export function generateDemoInvoiceFromReservation(
  reservation: DemoReservation,
  paymentMethod: string = 'Espèces',
  status: 'paid' | 'pending' = 'paid'
): DemoInvoice {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `FACT-${year}-${month}-`

  // Find last invoice number
  const lastInv = DEMO_INVOICES
    .filter(i => i.invoice_number.startsWith(prefix))
    .sort((a, b) => b.invoice_number.localeCompare(a.invoice_number))[0]

  let nextCounter = 1
  if (lastInv?.invoice_number) {
    const lastCounterStr = lastInv.invoice_number.substring(prefix.length)
    const lastCounter = parseInt(lastCounterStr, 10)
    if (!isNaN(lastCounter)) {
      nextCounter = lastCounter + 1
    }
  }

  _demoInvoiceCounter++
  const invoiceNumber = `${prefix}${String(nextCounter).padStart(4, '0')}`
  const nights = Math.max(1, Math.ceil((new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / (1000 * 60 * 60 * 24)))
  const pricePerNight = Math.round(reservation.total_price / nights)
  const subtotal = Math.round(reservation.total_price / 1.18)
  const vat = reservation.total_price - subtotal

  const isPaid = status === 'paid'
  let receiptNumber: string | null = null
  if (isPaid) {
    const recPrefix = `REC-${year}-${month}-`
    const lastRec = DEMO_INVOICES
      .filter(i => i.receipt_number && i.receipt_number.startsWith(recPrefix))
      .sort((a, b) => (b.receipt_number || '').localeCompare(a.receipt_number || ''))[0]
    let recCounter = 1
    if (lastRec?.receipt_number) {
      const lastCounterStr = lastRec.receipt_number.substring(recPrefix.length)
      const lastCounter = parseInt(lastCounterStr, 10)
      if (!isNaN(lastCounter)) {
        recCounter = lastCounter + 1
      }
    }
    receiptNumber = `${recPrefix}${String(recCounter).padStart(4, '0')}`
  }

  const invoice: DemoInvoice = {
    id: `inv-auto-${Date.now()}-${_demoInvoiceCounter}`,
    hotel_id: reservation.hotel_id,
    invoice_number: invoiceNumber,
    reservation_id: reservation.id,
    customer_id: reservation.customer_id,
    subtotal,
    tourist_tax: 0,
    vat,
    total_amount: reservation.total_price,
    payment_method: paymentMethod,
    status,
    receipt_number: receiptNumber,
    paid_at: isPaid ? now.toISOString() : null,
    notes: status === 'paid' ? 'Facture auto-générée (Walk-in)' : 'Facture auto-générée (En attente de paiement)',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    customers: { first_name: reservation.customers.first_name, last_name: reservation.customers.last_name, phone: reservation.customers.phone, email: reservation.customers.email },
    reservations: {
      id: reservation.id,
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      rooms: { id: reservation.rooms.id, room_number: reservation.rooms.room_number, room_type: reservation.rooms.room_type },
    },
    invoice_items: [
      {
        id: `item-auto-${Date.now()}-${_demoInvoiceCounter}`,
        invoice_id: `inv-auto-${Date.now()}-${_demoInvoiceCounter}`,
        description: `Chambre ${reservation.rooms.room_number} (${reservation.rooms.room_type}) — Nuitée`,
        quantity: nights,
        unit_price: pricePerNight,
        total: reservation.total_price,
      },
    ],
  }

  DEMO_INVOICES.unshift(invoice)
  return invoice
}

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
