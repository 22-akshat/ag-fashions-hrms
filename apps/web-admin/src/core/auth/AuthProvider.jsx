import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/module1/employees/lib/supabase/client'
import { clearLegacyAuthStorage } from '@/core/auth/authStorage'
import * as authApi from '@/core/auth/authApi'
import { AuthContext } from '@/core/auth/useAuth'
import { toast } from '@/hooks/use-toast'

function mapUserToAuthUser(user) {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  return {
    username: user.email ?? '',
    full_name: typeof meta.full_name === 'string' ? meta.full_name : meta.name ?? '',
    role: typeof meta.role === 'string' ? meta.role : '',
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const hasClient = Boolean(supabase)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasClient)

  useEffect(() => {
    clearLegacyAuthStorage()
  }, [])

  useEffect(() => {
    if (!hasClient) return

    let cancelled = false

    authApi.getCurrentSession().then((s) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [hasClient])

  const signOut = useCallback(async () => {
    await authApi.signOut()
    toast({
      title: 'Signed out',
      description: 'Your session has been cleared on this device.',
    })
    navigate('/login', { replace: true })
  }, [navigate])

  const authUser = useMemo(() => mapUserToAuthUser(user), [user])

  const value = useMemo(
    () => ({
      session,
      user,
      authUser,
      loading,
      isAuthenticated: Boolean(session),
      signOut,
    }),
    [session, user, authUser, loading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
