/** Legacy HRMS localStorage keys (pre–Supabase Auth). Cleared on boot. */
const LEGACY_KEYS = ['hrms-authenticated', 'hrms-auth-user']

export function clearLegacyAuthStorage() {
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    /* ignore private mode / quota */
  }
}
