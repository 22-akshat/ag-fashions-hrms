import { getStoredDeviceKeys, setStoredDeviceKeys } from './secureStorage';

export type DeviceKeypair = {
  publicKey: string;
  privateKey: string;
};

function pseudoPair(): DeviceKeypair {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  const a = c?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
  const b = c?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
  return {
    publicKey: `pub_${a}`,
    privateKey: `priv_${b}`,
  };
}

export async function getOrCreateDeviceKeypair(): Promise<DeviceKeypair> {
  const stored = await getStoredDeviceKeys();
  if (stored.publicKey && stored.privateKey) {
    return { publicKey: stored.publicKey, privateKey: stored.privateKey };
  }
  const kp = pseudoPair();
  await setStoredDeviceKeys(kp);
  return kp;
}
