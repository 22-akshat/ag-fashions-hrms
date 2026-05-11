import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'attendance_device_install_id';

function generateUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable id for this app install (AsyncStorage). */
export async function getOrCreateDeviceInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
  } catch {
    // fall through to regenerate
  }
  const next = generateUuid();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // still return ephemeral id for this session if storage fails
  }
  return next;
}
