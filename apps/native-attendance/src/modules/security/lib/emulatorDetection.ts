import DeviceInfo from 'react-native-device-info';

export async function detectEmulator(): Promise<{ emulator: boolean; reason: string | null }> {
  const isEmu = await DeviceInfo.isEmulator();
  if (isEmu) {
    return { emulator: true, reason: 'deviceinfo_reports_emulator' };
  }
  const model = (await DeviceInfo.getModel()).toLowerCase();
  if (/(sdk|emulator|simulator|genymotion)/.test(model)) {
    return { emulator: true, reason: `suspicious_model:${model}` };
  }
  return { emulator: false, reason: null };
}
