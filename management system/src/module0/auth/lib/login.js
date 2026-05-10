import { supabase } from '@/module1/employees/lib/supabase/client'

export async function verifyLoginCredentials(username, password) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
  }

  const normalizedUsername = username.trim()
  const normalizedPassword = password.trim()

  if (!normalizedUsername || !normalizedPassword) {
    throw new Error('Username and password are required.')
  }

  const { data, error } = await supabase
    .from('hr_login_credentials')
    .select('id, username, full_name, role')
    .ilike('username', normalizedUsername)
    .eq('password', normalizedPassword)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getLoginDebugDetails(username, password) {
  if (!supabase) {
    return { reason: 'supabase_not_configured' }
  }

  const normalizedUsername = username.trim()
  const normalizedPassword = password.trim()

  const { data: usernameRows, error: usernameError } = await supabase
    .from('hr_login_credentials')
    .select('id, username')
    .ilike('username', normalizedUsername)

  if (usernameError) {
    return { reason: 'username_query_error', message: usernameError.message }
  }

  const { data: exactRows, error: exactError } = await supabase
    .from('hr_login_credentials')
    .select('id, username')
    .ilike('username', normalizedUsername)
    .eq('password', normalizedPassword)

  if (exactError) {
    return { reason: 'exact_query_error', message: exactError.message }
  }

  return {
    reason: 'no_match',
    usernameRows: usernameRows?.length ?? 0,
    exactRows: exactRows?.length ?? 0,
    usernames: (usernameRows || []).map((row) => row.username).join(', ') || 'none',
  }
}
