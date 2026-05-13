import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPLOYEE_ID_STORAGE_KEY } from './constants';

/**
 * Background Expo Location task is not ported yet. We persist the employee id for a future
 * Android Headless JS / FGS implementation (`employee_upsert_location` RPC).
 */
export async function startTracking(employeeId: string): Promise<void> {
  const id = String(employeeId ?? '').trim();
  if (!id) return;
  await AsyncStorage.setItem(EMPLOYEE_ID_STORAGE_KEY, id);
}

export async function stopTracking(): Promise<void> {
  await AsyncStorage.removeItem(EMPLOYEE_ID_STORAGE_KEY);
}
