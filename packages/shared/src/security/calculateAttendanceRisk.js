import { calculateDeviceTrust } from './calculateDeviceTrust.js'

function uniq(arr) {
  return [...new Set(arr)]
}

/**
 * @param {{
 * gpsMismatch?: boolean,
 * rapidMovement?: boolean,
 * rooted?: boolean,
 * emulator?: boolean,
 * vpn?: boolean,
 * mockGps?: boolean,
 * blockedDevice?: boolean,
 * staleDevice?: boolean,
 * suspiciousIp?: boolean,
 * integrityUnavailable?: boolean,
 * repeatedFailures?: number,
 * newDevice?: boolean
 * }} input
 */
export function calculateAttendanceRisk(input = {}) {
  const trust = calculateDeviceTrust(input)
  let score = Math.min(100, Math.max(0, 100 - trust.score))
  const reasons = [...trust.reasons]

  if (input.gpsMismatch) {
    score += 18
    reasons.push('gps_mismatch')
  }
  if (input.rapidMovement) {
    score += 10
    reasons.push('rapid_movement')
  }
  if (input.newDevice) {
    score += 8
    reasons.push('new_device')
  }

  if (score > 100) score = 100
  let severity = 'low'
  if (score >= 85) severity = 'critical'
  else if (score >= 65) severity = 'high'
  else if (score >= 40) severity = 'medium'

  return { score, severity, reasons: uniq(reasons) }
}

