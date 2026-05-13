import { Platform } from 'react-native';

import { getPlayIntegrityToken } from './playIntegrity';
import { getAppAttestToken } from './appAttest';

export type AttestationResult = {
  isValid: boolean;
  reason?: string;
  integrityToken: string;
  deviceScore: number;
  provider: 'play_integrity' | 'app_attest' | 'unknown';
};

export async function collectAttestation(): Promise<AttestationResult> {
  if (Platform.OS === 'android') {
    const r = await getPlayIntegrityToken();
    return { ...r, provider: 'play_integrity' };
  }
  if (Platform.OS === 'ios') {
    const r = await getAppAttestToken();
    return { ...r, provider: 'app_attest' };
  }
  return {
    isValid: false,
    integrityToken: '',
    deviceScore: 0,
    reason: 'unsupported_platform',
    provider: 'unknown',
  };
}
