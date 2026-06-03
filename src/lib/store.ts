import { create } from 'zustand'
import type { AppView, DashboardTab, Profile, Hotel } from '@/lib/types'

interface AppState {
  view: AppView
  dashboardTab: DashboardTab
  user: Profile | null
  currentHotel: Hotel | null
  hotels: Hotel[]
  isLoading: boolean
  setView: (view: AppView) => void
  setDashboardTab: (tab: DashboardTab) => void
  setUser: (user: Profile | null) => void
  setCurrentHotel: (hotel: Hotel | null) => void
  setHotels: (hotels: Hotel[]) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'setup',
  dashboardTab: 'overview',
  user: null,
  currentHotel: null,
  hotels: [],
  isLoading: false,
  setView: (view) => set({ view }),
  setDashboardTab: (dashboardTab) => set({ dashboardTab }),
  setUser: (user) => set({ user }),
  setCurrentHotel: (currentHotel) => set({ currentHotel }),
  setHotels: (hotels) => set({ hotels }),
  setIsLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, currentHotel: null, hotels: [], view: 'login', dashboardTab: 'overview' }),
}))
