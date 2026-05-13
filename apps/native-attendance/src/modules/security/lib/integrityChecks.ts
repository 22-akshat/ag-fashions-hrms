import { Platform } from 'react-native';

import { checkAppSignatureHook } from './appIntegrity';
import { detectEmulator } from './emulatorDetection';
import { detectVpn } from './vpnDetection';
import { detectMockLocation } from './mockLocationDetection';

export type IntegritySnapshot = {
  rooted: boolean;
  emulator: boolean;
  vpn: boolean;
  mockGps: boolean;
  developerMode: boolean;
  signatureValid: boolean;
  integrityUnavailable: boolean;
  reasons: string[];
  platform: string;
  appId: string | null;
};

export async function runIntegrityChecks(input?: {
  mocked?: boolean | null;
  accuracy?: number | null;
}): Promise<IntegritySnapshot> {
  const reasons: string[] = [];
  const [emu, vpn, sig] = await Promise.all([
    detectEmulator(),
    detectVpn(),
    checkAppSignatureHook(),
  ]);
  const mock = detectMockLocation({ mocked: input?.mocked, accuracy: input?.accuracy });
  const rooted = false;
  const developerMode = false;

  if (emu.reason) reasons.push(emu.reason);
  if (vpn.reason && vpn.vpn) reasons.push(vpn.reason);
  if (mock.reason) reasons.push(mock.reason);
  if (!sig.signatureValid && sig.reason) reasons.push(sig.reason);
  if (rooted) reasons.push('rooted_or_jailbroken_detected');
  if (developerMode) reasons.push('developer_mode_or_non_physical_device');

  const integrityUnavailable =
    reasons.some((r) => r.startsWith('app_integrity_unavailable')) ||
    reasons.some((r) => r.startsWith('vpn_detection_unavailable'));

  return {
    rooted,
    emulator: emu.emulator,
    vpn: vpn.vpn,
    mockGps: mock.mockGps,
    developerMode,
    signatureValid: sig.signatureValid,
    integrityUnavailable,
    reasons,
    platform: String(Platform.OS),
    appId: sig.appId,
  };
}
