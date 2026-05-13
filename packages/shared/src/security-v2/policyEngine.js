export function evaluateSecurityPolicy(input) {
  const policy = input?.policy ?? {};
  const signals = input?.signals ?? {};
  const blocks = [];
  const warns = [];

  const blockIf = (key, code) => {
    if (policy[key] === 'block' && signals[key] === true) blocks.push(code);
    else if (policy[key] === 'warn' && signals[key] === true) warns.push(code);
  };

  blockIf('emulator', 'EMULATOR_SIGNAL');
  blockIf('vpn', 'VPN_SIGNAL');
  blockIf('root', 'ROOT_SIGNAL');
  blockIf('attestation_failure', 'ATTESTATION_FAILURE');
  blockIf('mock_gps', 'MOCK_GPS_SIGNAL');

  const anomalyThreshold = Number(policy.anomaly_score_threshold ?? 70);
  const anomalyScore = Number(signals.anomaly_score ?? 0);
  if (Number.isFinite(anomalyThreshold) && Number.isFinite(anomalyScore) && anomalyScore >= anomalyThreshold) {
    blocks.push('ANOMALY_THRESHOLD_EXCEEDED');
  }

  return {
    decision: blocks.length ? 'block' : warns.length ? 'warn' : 'allow',
    blocks,
    warns,
  };
}

