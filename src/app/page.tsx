'use client'

import { useState, useEffect } from 'react'
import { SetupWizard } from '@/components/setup-wizard'
import { LoginForm } from '@/components/login-form'
import { Dashboard } from '@/components/dashboard'
import type { Profile } from '@/lib/types'

type AppView = 'setup' | 'login' | 'dashboard'

export default function Home() {
  const [view, setView] = useState<AppView>('setup')
  const [profile, setProfile] = useState<Profile | null>(null)

  // Check initial setup status on mount
  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/setup/check')
        if (res.ok) {
          const data = await res.json()
          if (data.ready) {
            setView('login')
          } else {
            setView('setup')
          }
        }
      } catch {
        setView('setup')
      }
    }
    checkSetup()
  }, [])

  const handleSetupComplete = () => {
    setView('login')
  }

  const handleLogin = (loggedInProfile: Profile) => {
    setProfile(loggedInProfile)
    setView('dashboard')
  }

  const handleLogout = () => {
    setProfile(null)
    setView('login')
  }

  // Render the appropriate view
  switch (view) {
    case 'setup':
      return <SetupWizard onComplete={handleSetupComplete} />
    case 'login':
      return <LoginForm onLogin={handleLogin} />
    case 'dashboard':
      return profile ? (
        <Dashboard profile={profile} onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )
    default:
      return <LoginForm onLogin={handleLogin} />
  }
}
