export type SecurityPolicy = {
  emulator: 'allow' | 'warn' | 'block';
  vpn: 'allow' | 'warn' | 'block';
  root: 'allow' | 'warn' | 'block';
  mock_gps: 'allow' | 'warn' | 'block';
  attestation_failure: 'allow' | 'warn' | 'block';
  anomaly_score_threshold: number;
};
