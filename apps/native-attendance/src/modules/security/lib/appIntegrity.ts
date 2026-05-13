import DeviceInfo from 'react-native-device-info';

const EXPECTED_APP_ID = String(process.env.EXPO_PUBLIC_EXPECTED_APP_ID ?? '').trim();

export async function checkAppSignatureHook(): Promise<{
  signatureValid: boolean;
  reason: string | null;
  appId: string | null;
}> {
  try {
    const appId = await DeviceInfo.getBundleId();
    if (!EXPECTED_APP_ID) {
      return { signatureValid: true, reason: 'expected_app_id_not_configured', appId };
    }
    const valid = appId === EXPECTED_APP_ID;
    return {
      signatureValid: valid,
      reason: valid ? null : `app_id_mismatch:${appId}`,
      appId,
    };
  } catch (e) {
    return { signatureValid: false, reason: `app_integrity_unavailable:${String(e)}`, appId: null };
  }
}
