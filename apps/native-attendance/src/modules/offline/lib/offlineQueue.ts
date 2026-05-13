import AsyncStorage from '@react-native-async-storage/async-storage';

import { decryptFromOfflineStorage, encryptForOfflineStorage } from './offlineEncryption';

const QUEUE_KEY = 'attendance_offline_queue_v1';
const MAX_QUEUE_SIZE = 60;

export type OfflineAttendanceItem = {
  offline_id: string;
  employee_id: string;
  device_id: string;
  shop_id: string;
  captured_at: string;
  integrity_snapshot: Record<string, unknown>;
  embedding_version: number;
  liveness_passed: boolean;
  locally_verified: boolean;
  risk_snapshot: Record<string, unknown>;
  attestation_token?: string;
  attestation_valid?: boolean;
  device_public_key?: string;
  signature: string;
  lat: number;
  lng: number;
  /** Preserved from the punch attempt (defaults to in when absent). */
  punch_type?: 'in' | 'out';
  idempotency_key?: string;
  retries: number;
  next_retry_at: string | null;
};

async function readQueue(): Promise<OfflineAttendanceItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const parsed = await decryptFromOfflineStorage(raw);
  const arr = parsed?.items;
  return Array.isArray(arr) ? (arr as OfflineAttendanceItem[]) : [];
}

async function writeQueue(items: OfflineAttendanceItem[]): Promise<void> {
  const safe = items.slice(0, MAX_QUEUE_SIZE);
  const encrypted = await encryptForOfflineStorage({ items: safe });
  await AsyncStorage.setItem(QUEUE_KEY, encrypted);
}

export async function enqueueOfflineItem(item: OfflineAttendanceItem): Promise<void> {
  const q = await readQueue();
  const existing = q.find((x) => x.offline_id === item.offline_id);
  if (existing) return;
  q.unshift(item);
  await writeQueue(q);
}

export async function listOfflineQueue(): Promise<OfflineAttendanceItem[]> {
  return readQueue();
}

export async function removeOfflineItem(offlineId: string): Promise<void> {
  const q = await readQueue();
  await writeQueue(q.filter((x) => x.offline_id !== offlineId));
}

export async function updateOfflineItem(item: OfflineAttendanceItem): Promise<void> {
  const q = await readQueue();
  const next = q.map((x) => (x.offline_id === item.offline_id ? item : x));
  await writeQueue(next);
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
