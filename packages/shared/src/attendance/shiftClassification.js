/**
 * Shift-based attendance classification (shared mobile + web).
 * Times are wall-clock "HH:mm" or "HH:mm:ss" strings (24h), typical of `employees.intime` / `outtime`.
 *
 * @param {object} input
 * @param {string | null | undefined} input.shiftStart
 * @param {string | null | undefined} input.shiftEnd
 * @param {Date | string | null | undefined} input.markInTime
 * @param {Date | string | null | undefined} input.markOutTime
 * @param {number} [input.graceInMinutes]
 * @param {number} [input.graceOutMinutes]
 * @param {string | null | undefined} [input.timeZone] IANA zone for punch clock minutes, e.g. Asia/Kolkata
 * @returns {{
 *   dayStatus: 'absent' | 'present' | 'late' | 'early_exit' | 'half_day'
 *   inStatus: 'none' | 'present' | 'late'
 *   outStatus: 'none' | 'present' | 'early_exit'
 * }}
 */
export function calculateAttendanceClassification(input) {
  const graceIn = Number.isFinite(input.graceInMinutes) ? input.graceInMinutes : 15
  const graceOut = Number.isFinite(input.graceOutMinutes) ? input.graceOutMinutes : 15
  const tz = typeof input.timeZone === 'string' && input.timeZone.trim() ? input.timeZone.trim() : null

  const startM = parseClockToMinutes(input.shiftStart, 9 * 60 + 30)
  const endM = parseClockToMinutes(input.shiftEnd, 18 * 60)

  const inDate = toDate(input.markInTime)
  const outDate = toDate(input.markOutTime)

  if (!inDate) {
    return { dayStatus: 'absent', inStatus: 'none', outStatus: 'none' }
  }

  const inM = minutesOfDayInZone(inDate, tz)
  let inStatus = 'present'
  if (inM > startM + graceIn) inStatus = 'late'

  if (!outDate) {
    return {
      dayStatus: inStatus === 'late' ? 'late' : 'present',
      inStatus,
      outStatus: 'none',
    }
  }

  const outM = minutesOfDayInZone(outDate, tz)
  let outStatus = 'present'
  if (outM < endM - graceOut) outStatus = 'early_exit'

  let dayStatus = 'present'
  if (inStatus === 'late' && outStatus === 'early_exit') dayStatus = 'half_day'
  else if (inStatus === 'late') dayStatus = 'late'
  else if (outStatus === 'early_exit') dayStatus = 'early_exit'

  return { dayStatus, inStatus, outStatus }
}

function toDate(v) {
  if (v == null) return null
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes()
}

/** Wall-clock minutes in `timeZone`, or device-local if `timeZone` is null. */
function minutesOfDayInZone(d, timeZone) {
  if (!timeZone) return minutesOfDay(d)
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const h = Number(parts.find((p) => p.type === 'hour')?.value)
    const m = Number(parts.find((p) => p.type === 'minute')?.value)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return minutesOfDay(d)
    return h * 60 + m
  } catch {
    return minutesOfDay(d)
  }
}

/** Parse "9:30", "09:30:00" → minutes from midnight; fallback `defaultMinutes`. */
export function parseClockToMinutes(raw, defaultMinutes) {
  const s = String(raw ?? '').trim()
  if (!s) return defaultMinutes
  const parts = s.split(':').map((p) => p.trim())
  const h = Number(parts[0])
  const m = parts[1] != null ? Number(parts[1]) : 0
  if (!Number.isFinite(h) || !Number.isFinite(m)) return defaultMinutes
  return h * 60 + m
}
