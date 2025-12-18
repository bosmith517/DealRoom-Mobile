/**
 * AuthContext
 *
 * Supabase authentication with session persistence.
 * Provides user, tenant_id, entitlements, and auth methods.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { createClient, Session, User } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { MMKV } from 'react-native-mmkv'

// Initialize MMKV for general storage
const storage = new MMKV()

// Supabase URL and Anon Key (safe to expose)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eskpnhbemnxkxafjbbdx.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

// Custom storage adapter for Supabase that uses SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Silently fail - SecureStore has size limits
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // Silently fail
    }
  },
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Types
interface Entitlement {
  app_key: string
  is_active: boolean
  features?: Record<string, boolean>
}

interface AuthState {
  user: User | null
  session: Session | null
  tenantId: string | null
  entitlements: Entitlement[]
  isLoading: boolean
  isAuthenticated: boolean
  hasEntitlement: (appKey: string) => boolean
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshEntitlements: () => Promise<void>
}

type AuthContextValue = AuthState & AuthActions

// Context
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Provider
interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user's tenant and entitlements
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch user profile to get tenant_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        return
      }

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id)

        // Fetch entitlements for this tenant
        const { data: entitlementData, error: entitlementError } = await supabase
          .from('tenant_app_entitlements')
          .select('app_key, is_active, features')
          .eq('tenant_id', profile.tenant_id)

        if (entitlementError) {
          console.error('Error fetching entitlements:', entitlementError)
        } else {
          setEntitlements(entitlementData || [])
          // Cache entitlements in MMKV
          storage.set('cached_entitlements', JSON.stringify(entitlementData))
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchUserData(session.user.id)
      }

      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserData(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setTenantId(null)
          setEntitlements([])
          storage.delete('cached_entitlements')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserData])

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }, [])

  // Sign up
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }, [])

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // Refresh entitlements
  const refreshEntitlements = useCallback(async () => {
    if (user) {
      await fetchUserData(user.id)
    }
  }, [user, fetchUserData])

  // Check if user has specific entitlement
  const hasEntitlement = useCallback(
    (appKey: string): boolean => {
      const entitlement = entitlements.find((e) => e.app_key === appKey)
      return entitlement?.is_active ?? false
    },
    [entitlements]
  )

  const value: AuthContextValue = {
    user,
    session,
    tenantId,
    entitlements,
    isLoading,
    isAuthenticated: !!session,
    hasEntitlement,
    signIn,
    signUp,
    signOut,
    refreshEntitlements,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Convenience hook for checking DealRoom entitlement
export function useDealRoomEntitlement(): boolean {
  const { hasEntitlement, isLoading } = useAuth()

  if (isLoading) return false
  return hasEntitlement('dealroom')
}
