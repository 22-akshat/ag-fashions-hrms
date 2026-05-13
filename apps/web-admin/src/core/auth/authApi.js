import { supabase, isSupabaseConfigured } from '@/module1/employees/lib/supabase/client'

/**
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function getCurrentSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  return data.session ?? null
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
  }
  const trimmedEmail = String(email ?? '').trim()
  const trimmedPassword = String(password ?? '')
  if (!trimmedEmail || !trimmedPassword) {
    throw new Error('Email and password are required.')
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password: trimmedPassword,
  })
  if (error) throw new Error(error.message)
  if (!data.session) throw new Error('Sign-in succeeded but no session was returned.')
  return data.session
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}
