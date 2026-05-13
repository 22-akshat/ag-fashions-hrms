import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const DEVICE_ID_KEY = 'attendance_device_install_id';

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function getOrCreateDeviceInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.trim()) return existing;

  const base = [
    DeviceInfo.getBundleId(),
    DeviceInfo.getVersion(),
    DeviceInfo.getBrand(),
    DeviceInfo.getModel(),
    DeviceInfo.getSystemName(),
    DeviceInfo.getSystemVersion(),
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join('|');

  const generated = `dev_${simpleHash(base)}_${Math.random().toString(36).slice(2, 8)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export async function getDeviceId(): Promise<string> {
  return getOrCreateDeviceInstallId();
}
