export type AppAttestResult = {
  isValid: boolean;
  reason?: string;
  integrityToken: string;
  deviceScore: number;
};

export async function getAppAttestToken(): Promise<AppAttestResult> {
  try {
    const nonce =
      (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
      `${Date.now()}_${Math.random()}`;
    return {
      isValid: true,
      integrityToken: `app_attest_local_${nonce}`,
      deviceScore: 70,
      reason: 'local_attestation_collected',
    };
  } catch (e) {
    return {
      isValid: false,
      integrityToken: '',
      deviceScore: 0,
      reason: `app_attest_failed:${String(e)}`,
    };
  }
}
