import { calculateDeviceTrust } from '@ag-fashions/shared/security';

import type { IntegritySnapshot } from './integrityChecks';

export type IntegrityClassification = {
  status: 'pass' | 'warn' | 'fail';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
};

export function classifyIntegrity(snapshot: IntegritySnapshot): IntegrityClassification {
  const trust = calculateDeviceTrust({
    rooted: snapshot.rooted,
    emulator: snapshot.emulator,
    vpn: snapshot.vpn,
    mockGps: snapshot.mockGps,
    integrityUnavailable: snapshot.integrityUnavailable,
  });
  const fail = snapshot.emulator || snapshot.mockGps || !snapshot.signatureValid;
  const warn = !fail && (snapshot.rooted || snapshot.vpn || snapshot.developerMode);

  return {
    status: fail ? 'fail' : warn ? 'warn' : 'pass',
    riskScore: 100 - trust.score,
    riskLevel: (trust.severity as 'low' | 'medium' | 'high' | 'critical') ?? 'low',
    reasons: snapshot.reasons,
  };
}
