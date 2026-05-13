function uniq(arr) {
  return [...new Set(arr)]
}

/**
 * @param {{
 * rooted?: boolean,
 * emulator?: boolean,
 * vpn?: boolean,
 * mockGps?: boolean,
 * blockedDevice?: boolean,
 * staleDevice?: boolean,
 * suspiciousIp?: boolean,
 * integrityUnavailable?: boolean,
 * repeatedFailures?: number
 * }} input
 */
export function calculateDeviceTrust(input = {}) {
  let score = 100
  const reasons = []

  if (input.blockedDevice) {
    score -= 70
    reasons.push('blocked_device')
  }
  if (input.emulator) {
    score -= 55
    reasons.push('emulator')
  }
  if (input.mockGps) {
    score -= 55
    reasons.push('mock_gps')
  }
  if (input.rooted) {
    score -= 25
    reasons.push('rooted_or_jailbroken')
  }
  if (input.vpn) {
    score -= 12
    reasons.push('vpn_active')
  }
  if (input.staleDevice) {
    score -= 18
    reasons.push('stale_device')
  }
  if (input.suspiciousIp) {
    score -= 15
    reasons.push('suspicious_ip')
  }
  if (input.integrityUnavailable) {
    score -= 10
    reasons.push('integrity_unavailable')
  }

  const failures = Number(input.repeatedFailures ?? 0)
  if (Number.isFinite(failures) && failures > 0) {
    const penalty = Math.min(20, failures * 3)
    score -= penalty
    reasons.push('repeated_failures')
  }

  if (score < 0) score = 0
  let severity = 'low'
  if (score <= 25) severity = 'critical'
  else if (score <= 45) severity = 'high'
  else if (score <= 70) severity = 'medium'

  return { score, severity, reasons: uniq(reasons) }
}

