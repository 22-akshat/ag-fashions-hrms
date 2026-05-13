export function calculateAnomalyScore(input = {}) {
  let score = 0;
  const reasons = [];

  if (input.integrityFailure) {
    score += 40;
    reasons.push('integrity_failure');
  }
  if (input.replayAttempt) {
    score += 45;
    reasons.push('replay_attempt');
  }
  if (input.geoJump) {
    score += 20;
    reasons.push('geo_jump');
  }
  if (input.deviceSwitchCount > 2) {
    score += 15;
    reasons.push('frequent_device_switch');
  }
  if (input.offlineBurst) {
    score += 20;
    reasons.push('offline_burst');
  }
  if (input.failedLiveness) {
    score += 15;
    reasons.push('failed_liveness');
  }

  if (score > 100) score = 100;
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, level, reasons };
}

