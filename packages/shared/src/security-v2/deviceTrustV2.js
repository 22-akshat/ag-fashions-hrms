export function computeDeviceTrustV2(input = {}) {
  let score = 100;
  const reasons = [];

  if (input.attestationValid === false) {
    score -= 55;
    reasons.push('attestation_invalid');
  }
  if (input.signatureValid === false) {
    score -= 35;
    reasons.push('signature_invalid');
  }
  if (input.emulator) {
    score -= 50;
    reasons.push('emulator');
  }
  if (input.mockGps) {
    score -= 50;
    reasons.push('mock_gps');
  }
  if (input.rooted) {
    score -= 20;
    reasons.push('rooted');
  }
  if (input.vpn) {
    score -= 12;
    reasons.push('vpn');
  }
  if (input.staleDevice) {
    score -= 15;
    reasons.push('stale_device');
  }

  if (score < 0) score = 0;
  const severity = score <= 25 ? 'critical' : score <= 45 ? 'high' : score <= 70 ? 'medium' : 'low';
  return { score, severity, reasons };
}

