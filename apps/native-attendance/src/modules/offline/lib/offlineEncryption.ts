import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

const KEY_REF = 'offline_queue_key_ref_v1';

function randomKey(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random()}`;
}

function xorToHex(input: string, key: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const a = input.charCodeAt(i);
    const b = key.charCodeAt(i % key.length);
    out += (a ^ b).toString(16).padStart(2, '0');
  }
  return out;
}

function hexToXor(input: string, key: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 2) {
    bytes.push(parseInt(input.slice(i, i + 2), 16));
  }
  return String.fromCharCode(...bytes.map((a, i) => a ^ key.charCodeAt(i % key.length)));
}

async function ensureKey(): Promise<string> {
  const existing = await EncryptedStorage.getItem(KEY_REF);
  if (existing) return existing;
  const key = randomKey();
  await EncryptedStorage.setItem(KEY_REF, key);
  return key;
}

export async function encryptForOfflineStorage(plain: Record<string, unknown>): Promise<string> {
  const key = await ensureKey();
  const raw = JSON.stringify(plain);
  return xorToHex(raw, key);
}

export async function decryptFromOfflineStorage(cipher: string): Promise<Record<string, unknown> | null> {
  if (!cipher) return null;
  const key = await ensureKey();
  try {
    const raw = hexToXor(cipher, key);
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function clearOfflineEncryptionKeys(): Promise<void> {
  await EncryptedStorage.removeItem(KEY_REF);
  await AsyncStorage.removeItem(KEY_REF);
}
