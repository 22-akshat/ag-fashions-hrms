export function formatSupabaseError(error) {
  if (error == null) return 'Unknown error'
  if (typeof error === 'object' && error !== null) {
    const msg = error.message != null ? String(error.message) : String(error)
    const parts = [
      msg,
      error.details ? `Details: ${error.details}` : null,
      error.hint ? `Hint: ${error.hint}` : null,
      error.code ? `Code: ${error.code}` : null,
    ].filter(Boolean)
    return parts.join(' — ')
  }
  return String(error)
}

