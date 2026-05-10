import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured() {
  return Boolean(url?.trim() && anonKey?.trim())
}

export const supabase = isSupabaseConfigured() ? createClient(url.trim(), anonKey.trim()) : null

