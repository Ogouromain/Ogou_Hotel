'use client'

import { useAuth } from '@/lib/auth-context'
import { LoginForm } from '@/components/login-form'
import { SetupWizard } from '@/components/setup-wizard'
import { Dashboard } from '@/components/dashboard'
import { SuperAdminPanel } from '@/components/super-admin-panel'
import { Loader2, Hotel } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import type { Profile } from '@/lib/types'

export default function Home() {
  const { user, profile, isLoading, isAuthenticated, signOut } = useAuth()
  const [setupReady, setSetupReady] = useState<boolean | null>(null) // null = not checked yet

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

  // Derive the view from state instead of using setState in effects
  const view = useMemo(() => {
    // Still checking setup
    if (setupReady === null) return 'loading'
    // Setup not ready
    if (!setupReady) return 'setup'
    // Auth is loading
    if (isLoading) return 'loading'
    // Authenticated with profile
    if (isAuthenticated && profile) return 'dashboard'
    // Not authenticated
    return 'login'
  }, [setupReady, isLoading, isAuthenticated, profile])

  const handleSetupComplete = () => {
    setSetupReady(true)
  }

  const handleLogout = async () => {
    await signOut()
  }

  // Loading state
  if (view === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Hotel className="w-8 h-8 text-white" />
            </div>
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
  if (view === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  // Login form
  if (view === 'login') {
    return <LoginForm />
  }

  // Dashboard
  if (view === 'dashboard' && profile) {
    // Super Admin gets a dedicated panel
    if (profile.role === 'super_admin') {
      return <SuperAdminPanel onLogout={handleLogout} profile={profile as Profile} />
    }
    return <Dashboard profile={profile as Profile} onLogout={handleLogout} />
  }

  // Fallback
  return <LoginForm />
}
