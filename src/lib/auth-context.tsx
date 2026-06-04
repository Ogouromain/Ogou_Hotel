'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

// ==================== TYPES ====================

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// ==================== CONTEXT ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ==================== PROVIDER ====================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabaseRef = useRef(createClient())
  const isMountedRef = useRef(true)

  const isAuthenticated = !!user && !!session

  // ---- Profile fetching via /api/auth/me (admin client, bypasses RLS) ----

  const fetchProfile = useCallback(async (currentUser: User): Promise<Profile | null> => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        console.error('fetchProfile: API returned', res.status)
        return null
      }
      const data = await res.json()
      if (data.error) {
        console.error('fetchProfile: API error', data.error)
        return null
      }
      return (data.profile as Profile) ?? null
    } catch (err) {
      console.error('fetchProfile: network error', err)
      return null
    }
  }, [])

  // ---- signIn ----

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const supabase = supabaseRef.current

        if (!supabase) {
          return { error: 'Supabase non configuré. Veuillez configurer les variables d\'environnement.' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          return { error: error.message }
        }

        if (data.user) {
          setUser(data.user)
          setSession(data.session)

          // Fetch profile via /api/auth/me (uses admin client, avoids RLS issues)
          const fetchedProfile = await fetchProfile(data.user)
          if (fetchedProfile) {
            setProfile(fetchedProfile)
          } else {
            console.warn('signIn: profile not found for user', data.user.id)
          }
        }

        return { error: null }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur de connexion'
        return { error: message }
      }
    },
    [fetchProfile]
  )

  // ---- signOut ----

  const signOut = useCallback(async () => {
    try {
      const supabase = supabaseRef.current
      if (supabase) {
        await supabase.auth.signOut()
      }

      // Call server-side logout to clear cookies
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('signOut error:', err)
    } finally {
      // Always clear local state regardless of API errors
      setUser(null)
      setProfile(null)
      setSession(null)
    }
  }, [])

  // ---- refreshProfile ----

  const refreshProfile = useCallback(async () => {
    const currentUser = user
    if (!currentUser) return

    const fetchedProfile = await fetchProfile(currentUser)
    if (isMountedRef.current) {
      setProfile(fetchedProfile)
    }
  }, [user, fetchProfile])

  // ---- Initial session check + auth state listener ----

  useEffect(() => {
    isMountedRef.current = true
    const supabase = supabaseRef.current

    // If Supabase is not configured, skip auth and show login
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isInitializing = true

    // 1. Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!isMountedRef.current) return

      if (existingSession) {
        setSession(existingSession)
        setUser(existingSession.user)

        // Fetch profile via /api/auth/me
        const fetchedProfile = await fetchProfile(existingSession.user)
        if (isMountedRef.current) {
          setProfile(fetchedProfile)
        }
      }

      if (isMountedRef.current) {
        setIsLoading(false)
      }
      isInitializing = false
    })

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Skip the INITIAL_SESSION event — we already handled it above
        if (isInitializing && event === 'INITIAL_SESSION') return
        if (!isMountedRef.current) return

        switch (event) {
          case 'SIGNED_IN': {
            setSession(newSession)
            setUser(newSession?.user ?? null)
            if (newSession?.user) {
              const fetchedProfile = await fetchProfile(newSession.user)
              if (isMountedRef.current) {
                setProfile(fetchedProfile)
              }
            }
            setIsLoading(false)
            break
          }

          case 'SIGNED_OUT': {
            setUser(null)
            setProfile(null)
            setSession(null)
            setIsLoading(false)
            break
          }

          case 'TOKEN_REFRESHED': {
            setSession(newSession)
            setUser(newSession?.user ?? null)
            setIsLoading(false)
            break
          }

          default: {
            // For other events, update session/user state
            setSession(newSession)
            setUser(newSession?.user ?? null)
            setIsLoading(false)
            break
          }
        }
      }
    )

    // 3. Cleanup on unmount
    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ---- Context value ----

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ==================== HOOK ====================

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
