import { supabase } from '../../../supabase';
import type { SecurityPolicy } from './policyTypes';

const DEFAULT_POLICY: SecurityPolicy = {
  emulator: 'block',
  vpn: 'warn',
  root: 'warn',
  mock_gps: 'block',
  attestation_failure: 'block',
  anomaly_score_threshold: 70,
};

export async function fetchSecurityPolicy(): Promise<SecurityPolicy> {
  const sb = supabase;
  if (!sb) return DEFAULT_POLICY;
  const { data, error } = await sb.functions.invoke('security-policy-engine');
  if (error || !data?.ok || !data?.policy) return DEFAULT_POLICY;
  const p = data.policy as Partial<SecurityPolicy>;
  return {
    emulator: p.emulator ?? DEFAULT_POLICY.emulator,
    vpn: p.vpn ?? DEFAULT_POLICY.vpn,
    root: p.root ?? DEFAULT_POLICY.root,
    mock_gps: p.mock_gps ?? DEFAULT_POLICY.mock_gps,
    attestation_failure: p.attestation_failure ?? DEFAULT_POLICY.attestation_failure,
    anomaly_score_threshold: Number.isFinite(Number(p.anomaly_score_threshold))
      ? Number(p.anomaly_score_threshold)
      : DEFAULT_POLICY.anomaly_score_threshold,
  };
}
