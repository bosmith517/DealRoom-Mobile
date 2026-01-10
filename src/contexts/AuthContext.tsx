/**
 * AuthContext
 *
 * Supabase authentication with session persistence.
 * Provides user, tenant_id, entitlements, and auth methods.
 *
 * IMPORTANT: Uses the shared Supabase client from lib/supabase.ts
 * This ensures all parts of the app use the same session.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Use the SINGLE shared Supabase client - this prevents profile bleed
// when switching users since all services use the same session
import { supabase } from '../lib/supabase'

// Re-export for backwards compatibility with files that import from AuthContext
export { supabase }

// Types
interface Entitlement {
  app_key: string
  is_enabled: boolean
  plan_key?: string
  status?: string
  current_period_start?: string
  current_period_end?: string
  trial_end?: string
  metadata?: Record<string, unknown>
}

interface AuthState {
  user: User | null
  session: Session | null
  tenantId: string | null
  platforms: string[]
  hasFlipmantisAccess: boolean
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
  const [platforms, setPlatforms] = useState<string[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Derived state: does user have FlipMantis platform access?
  // Per pricing SSoT, all users (including free tier) have mobile access.
  // Feature gating (readonly, D4D, etc.) is handled by tier limits, not platform array.
  // Everyone who authenticates gets access; tier controls what they can do.
  const hasFlipmantisAccess = true

  // Fetch user's tenant, platforms, and entitlements
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch user's tenant and platform access from tenant_users
      const { data: userTenant, error: tenantError } = await supabase
        .from('tenant_users')
        .select('tenant_id, platforms')
        .eq('user_id', userId)
        .single()

      if (tenantError) {
        console.error('Error fetching tenant:', tenantError)
        return
      }

      if (!userTenant?.tenant_id) {
        console.error('No tenant found for user')
        return
      }

      setTenantId(userTenant.tenant_id)
      setPlatforms(userTenant.platforms || [])

      // Check if user has FlipMantis platform access
      const userPlatforms = userTenant.platforms || []
      if (!userPlatforms.includes('flipmantis')) {
        console.log('User does not have FlipMantis platform access')
        // Still set empty entitlements so the app knows access check is complete
        setEntitlements([])
        return
      }

      // User has platform access, fetch entitlements for tier/feature info
      const { data: entitlementData, error: entitlementError } = await supabase
        .from('dealroom_tenant_entitlements')
        .select('app_key, is_enabled, plan_key, status, current_period_start, current_period_end, trial_end, metadata')
        .eq('tenant_id', userTenant.tenant_id)

      if (entitlementError) {
        console.error('Error fetching entitlements:', entitlementError)
      } else {
        setEntitlements(entitlementData || [])
        // Cache entitlements in AsyncStorage (fire and forget)
        AsyncStorage.setItem('@flipmantis:cached_entitlements', JSON.stringify(entitlementData)).catch(() => {})
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
          // Force refresh to clear any stale cached user data from previous session
          // This ensures getUser() calls in services return the new user, not cached old user
          await supabase.auth.refreshSession()
          await fetchUserData(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          // Reset all auth state
          setTenantId(null)
          setPlatforms([])
          setEntitlements([])

          // Clear ALL cached data to prevent profile bleed
          // This catches server-side session expiry, not just explicit signOut
          try {
            const keys = await AsyncStorage.getAllKeys()
            const flipmantisKeys = keys.filter((key) => key.startsWith('@flipmantis:'))
            if (flipmantisKeys.length > 0) {
              await AsyncStorage.multiRemove(flipmantisKeys)
            }
            console.log(`[Auth] SIGNED_OUT: Cleared ${flipmantisKeys.length} cached keys`)
          } catch (err) {
            console.error('[Auth] Error clearing cached data on SIGNED_OUT:', err)
          }
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

  // Sign out - CRITICAL: Clear all user data from local storage
  const signOut = useCallback(async () => {
    // Clear ALL @flipmantis cached data to prevent data leakage between accounts
    // This is more thorough than listing individual keys
    try {
      const keys = await AsyncStorage.getAllKeys()
      const flipmantisKeys = keys.filter((key) => key.startsWith('@flipmantis:'))
      if (flipmantisKeys.length > 0) {
        await AsyncStorage.multiRemove(flipmantisKeys)
      }
      console.log(`[Auth] Cleared ${flipmantisKeys.length} cached keys`)
    } catch (err) {
      console.error('[Auth] Error clearing cached data:', err)
    }
    // Sign out with global scope to ensure complete session invalidation
    // This clears all sessions including any cached session data in the client
    await supabase.auth.signOut({ scope: 'global' })
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
      return entitlement?.is_enabled ?? false
    },
    [entitlements]
  )

  const value: AuthContextValue = {
    user,
    session,
    tenantId,
    platforms,
    hasFlipmantisAccess,
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

// Convenience hook for checking FlipMantis entitlement
export function useFlipMantisEntitlement(): boolean {
  const { hasEntitlement, isLoading } = useAuth()

  if (isLoading) return false
  return hasEntitlement('flipmantis')
}

// Legacy alias for backwards compatibility
export const useDealRoomEntitlement = useFlipMantisEntitlement
