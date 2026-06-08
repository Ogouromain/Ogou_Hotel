'use client'

import { useAuth } from '@/lib/auth-context'
import { LoginForm } from '@/components/login-form'
import { RegisterForm } from '@/components/register-form'
import { SetupWizard } from '@/components/setup-wizard'
import { LandingPage } from '@/components/landing-page'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Profile } from '@/lib/types'

// ─── Dynamic Imports for Heavy Dashboard Components ────────────────────────
// These are loaded only when the user is authenticated, reducing the
// initial bundle size by ~30% for the landing page experience.

const Dashboard = dynamic(
  () => import('@/components/dashboard').then(mod => ({ default: mod.Dashboard })),
  { ssr: false }
)
const SuperAdminPanel = dynamic(
  () => import('@/components/super-admin-panel').then(mod => ({ default: mod.SuperAdminPanel })),
  { ssr: false }
)
const OwnerDashboard = dynamic(
  () => import('@/components/owner-dashboard').then(mod => ({ default: mod.OwnerDashboard })),
  { ssr: false }
)
const StaffDashboard = dynamic(
  () => import('@/components/staff-dashboard').then(mod => ({ default: mod.StaffDashboard })),
  { ssr: false }
)

type AppView = 'loading' | 'setup' | 'landing' | 'login' | 'register' | 'dashboard'

export default function Home() {
  const { profile, isLoading, isAuthenticated, signOut } = useAuth()
  const [setupReady, setSetupReady] = useState<boolean | null>(null) // null = not checked yet
  const [isNewRegistration, setIsNewRegistration] = useState(false)
  const [wantsRegister, setWantsRegister] = useState(false) // User explicitly clicked "Register"
  const [wantsLogin, setWantsLogin] = useState(false) // User explicitly clicked "Login"

  // Check setup status on mount
  useEffect(() => {
    let cancelled = false
    async function checkSetup() {
      try {
        const res = await fetch('/api/setup/check')
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSetupReady(data.ready === true)
          return
        }
      } catch {
        // If setup check fails, proceed to auth check
      }
      if (!cancelled) setSetupReady(true)
    }
    checkSetup()
    return () => { cancelled = true }
  }, [])

  // Derive the auto-computed view from auth state
  const autoView = useMemo<AppView>(() => {
    if (setupReady === null) return 'loading'
    if (!setupReady) return 'setup'
    if (isLoading) return 'loading'
    if (isAuthenticated && profile) return 'dashboard'
    // Default: show landing page instead of login
    return 'landing'
  }, [setupReady, isLoading, isAuthenticated, profile])

  // Determine the actual view to show:
  const currentView = useMemo<AppView>(() => {
    if (wantsRegister && (autoView === 'landing' || autoView === 'login')) return 'register'
    if (wantsLogin && (autoView === 'landing' || autoView === 'register')) return 'login'
    return autoView
  }, [wantsRegister, wantsLogin, autoView])

  const handleSetupComplete = useCallback(() => {
    setSetupReady(true)
  }, [])

  const handleLogout = useCallback(async () => {
    await signOut()
    setIsNewRegistration(false)
    setWantsRegister(false)
    setWantsLogin(false)
  }, [signOut])

  const handleSwitchToRegister = useCallback(() => {
    setWantsRegister(true)
    setWantsLogin(false)
  }, [])

  const handleSwitchToLogin = useCallback(() => {
    setWantsLogin(true)
    setWantsRegister(false)
  }, [])

  const handleRegistrationSuccess = useCallback(() => {
    setIsNewRegistration(true)
    setWantsRegister(false) // After registration, auth state updates → autoView becomes 'dashboard'
  }, [])

  // Loading state
  if (currentView === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Image src="/logo.png" alt="OGOU_Hôtel" height={64} width={64} className="object-contain" />
          </div>
          <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          <p className="text-sm text-muted-foreground">
            Chargement de votre espace...
          </p>
        </div>
      </div>
    )
  }

  // Setup wizard
  if (currentView === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  // Landing page (new default for unauthenticated users)
  if (currentView === 'landing') {
    return (
      <LandingPage
        onLogin={handleSwitchToLogin}
        onRegister={handleSwitchToRegister}
        onDemo={handleSwitchToRegister}
      />
    )
  }

  // Registration form
  if (currentView === 'register') {
    return (
      <RegisterForm
        onSwitchToLogin={handleSwitchToLogin}
        onRegistrationSuccess={handleRegistrationSuccess}
      />
    )
  }

  // Login form
  if (currentView === 'login') {
    return (
      <LoginForm
        onSwitchToRegister={handleSwitchToRegister}
      />
    )
  }

  // Dashboard
  if (currentView === 'dashboard' && profile) {
    // Super Admin gets a dedicated panel
    if (profile.role === 'super_admin') {
      return <SuperAdminPanel onLogout={handleLogout} profile={profile as Profile} />
    }
    // Owner gets the dedicated owner dashboard
    if (profile.role === 'owner') {
      return (
        <OwnerDashboard
          profile={profile as Profile}
          onLogout={handleLogout}
          isNewRegistration={isNewRegistration}
        />
      )
    }
    // Staff roles (receptionist, manager, housekeeper, restaurant_staff) get the staff dashboard
    if (['receptionist', 'manager', 'housekeeper', 'restaurant_staff'].includes(profile.role)) {
      return <StaffDashboard profile={profile as Profile} onLogout={handleLogout} />
    }
    // Fallback for unknown roles — generic dashboard
    return <Dashboard profile={profile as Profile} onLogout={handleLogout} />
  }

  // Fallback
  return (
    <LandingPage
      onLogin={handleSwitchToLogin}
      onRegister={handleSwitchToRegister}
      onDemo={handleSwitchToRegister}
    />
  )
}
