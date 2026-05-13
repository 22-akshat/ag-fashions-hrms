export function evaluateFraudRules(input = {}) {
  const flags = [];
  if (input.offlineReplayDetected) flags.push('offline_replay_detected');
  if (input.invalidSignature) flags.push('invalid_device_signature');
  if (input.mockLocationDetected) flags.push('mock_location_detected');
  if (input.emulatorDetected) flags.push('emulator_detected');
  if (input.attestationInvalid) flags.push('attestation_invalid');
  return {
    flags,
    isFraudLikely: flags.length >= 2,
  };
}

