// ==================== DATABASE TYPES ====================

export type HotelStatus = 'active' | 'suspended' | 'inactive'
export type ProfileStatus = 'active' | 'suspended'
export type UserRole = 'super_admin' | 'owner' | 'manager' | 'receptionist' | 'restaurant_staff' | 'housekeeper'
export type SubscriptionStatus = 'active' | 'suspended' | 'expired'
export type ActivationCodeStatus = 'unused' | 'used' | 'expired'
export type LeadStatus = 'new' | 'contacted' | 'paid' | 'cancelled'
export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance'
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type OrderStatus = 'pending' | 'preparing' | 'served' | 'paid' | 'cancelled'
export type StockTransactionType = 'in' | 'out'

export interface Hotel {
  id: string
  name: string
  address: string | null
  city: string
  phone: string
  email: string | null
  status: HotelStatus
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  hotel_id: string | null
  first_name: string
  last_name: string
  role: UserRole
  phone: string | null
  status: ProfileStatus
  created_at: string
  updated_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  price_fcfa: number
  max_rooms: number
  max_receptionists: number
  max_managers: number
  support_type: string
  created_at: string
}

export interface Subscription {
  id: string
  hotel_id: string
  plan_id: string
  starts_at: string
  ends_at: string
  status: SubscriptionStatus
  created_at: string
  updated_at: string
}

export interface ActivationCode {
  id: string
  code: string
  plan_id: string
  duration_months: number
  status: ActivationCodeStatus
  created_by: string
  used_by_hotel_id: string | null
  expires_at: string
  created_at: string
  used_at: string | null
}

export interface Lead {
  id: string
  hotel_name: string
  prospect_name: string
  prospect_email: string
  prospect_phone: string
  hotel_size_rooms: number
  status: LeadStatus
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  hotel_id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: RoomStatus
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  hotel_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  identity_document_type: string | null
  identity_document_number: string | null
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  hotel_id: string
  customer_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  total_price: number
  status: ReservationStatus
  created_at: string
  updated_at: string
}

export interface ConferenceRoom {
  id: string
  hotel_id: string
  name: string
  capacity: number
  price_per_hour: number
  status: string
  created_at: string
}

export interface ConferenceBooking {
  id: string
  hotel_id: string
  conference_room_id: string
  customer_id: string
  start_time: string
  end_time: string
  total_price: number
  status: string
  created_at: string
}

export interface RestaurantOrder {
  id: string
  hotel_id: string
  room_id: string | null
  table_number: string | null
  total_amount: number
  status: OrderStatus
  created_at: string
}

export interface RestaurantOrderItem {
  id: string
  order_id: string
  item_name: string
  quantity: number
  unit_price: number
}

export interface StockItem {
  id: string
  hotel_id: string
  name: string
  quantity: number
  unit: string
  min_threshold: number
  created_at: string
}

export interface StockTransaction {
  id: string
  hotel_id: string
  stock_item_id: string
  type: StockTransactionType
  quantity: number
  reason: string
  created_by: string
  created_at: string
}

export interface AuditLog {
  id: string
  hotel_id: string | null
  profile_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      hotels: { Row: Hotel; Insert: Omit<Hotel, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Hotel, 'id' | 'created_at'>> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> }
      subscription_plans: { Row: SubscriptionPlan; Insert: Omit<SubscriptionPlan, 'id' | 'created_at'>; Update: Partial<Omit<SubscriptionPlan, 'id' | 'created_at'>> }
      subscriptions: { Row: Subscription; Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Subscription, 'id' | 'created_at'>> }
      activation_codes: { Row: ActivationCode; Insert: Omit<ActivationCode, 'id' | 'created_at'>; Update: Partial<Omit<ActivationCode, 'id' | 'created_at'>> }
      leads: { Row: Lead; Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Lead, 'id' | 'created_at'>> }
      rooms: { Row: Room; Insert: Omit<Room, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Room, 'id' | 'created_at'>> }
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Customer, 'id' | 'created_at'>> }
      reservations: { Row: Reservation; Insert: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Reservation, 'id' | 'created_at'>> }
      conference_rooms: { Row: ConferenceRoom; Insert: Omit<ConferenceRoom, 'id' | 'created_at'>; Update: Partial<Omit<ConferenceRoom, 'id' | 'created_at'>> }
      conference_bookings: { Row: ConferenceBooking; Insert: Omit<ConferenceBooking, 'id' | 'created_at'>; Update: Partial<Omit<ConferenceBooking, 'id' | 'created_at'>> }
      restaurant_orders: { Row: RestaurantOrder; Insert: Omit<RestaurantOrder, 'id' | 'created_at'>; Update: Partial<Omit<RestaurantOrder, 'id' | 'created_at'>> }
      restaurant_order_items: { Row: RestaurantOrderItem; Insert: Omit<RestaurantOrderItem, 'id'>; Update: Partial<Omit<RestaurantOrderItem, 'id'>> }
      stock_items: { Row: StockItem; Insert: Omit<StockItem, 'id' | 'created_at'>; Update: Partial<Omit<StockItem, 'id' | 'created_at'>> }
      stock_transactions: { Row: StockTransaction; Insert: Omit<StockTransaction, 'id' | 'created_at'>; Update: Partial<Omit<StockTransaction, 'id' | 'created_at'>> }
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: Partial<Omit<AuditLog, 'id' | 'created_at'>> }
    }
  }
}

// ==================== APP STATE TYPES ====================

export type AppView = 'setup' | 'login' | 'dashboard'
export type DashboardTab = 
  | 'overview' 
  | 'hotels' 
  | 'rooms' 
  | 'reservations' 
  | 'customers' 
  | 'restaurant' 
  | 'stock' 
  | 'conference' 
  | 'subscriptions' 
  | 'codes' 
  | 'leads' 
  | 'audit' 
  | 'users'

export interface AppState {
  view: AppView
  dashboardTab: DashboardTab
  user: Profile | null
  currentHotel: Hotel | null
  hotels: Hotel[]
  setView: (view: AppView) => void
  setDashboardTab: (tab: DashboardTab) => void
  setUser: (user: Profile | null) => void
  setCurrentHotel: (hotel: Hotel | null) => void
  setHotels: (hotels: Hotel[]) => void
  logout: () => void
}

export interface SetupStatus {
  tablesExist: boolean
  adminExists: boolean
  plansSeeded: boolean
  ready: boolean
}
