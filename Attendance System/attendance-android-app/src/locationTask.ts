import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import {
  EMPLOYEE_ID_STORAGE_KEY,
  LOCATION_TASK_NAME,
} from './constants';
import { resolveEmployeeUuidForSupabase } from './lib/employeeIdResolve';
import { supabase } from './supabase';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] Task error:', error.message);
    return;
  }

  if (!supabase) {
    console.warn('[LocationTask] Missing Supabase environment config.');
    return;
  }

  const employeeRaw = await AsyncStorage.getItem(EMPLOYEE_ID_STORAGE_KEY);
  if (!employeeRaw) {
    console.warn('[LocationTask] Employee ID missing, skipping location upload.');
    return;
  }

  const employeeUuid = await resolveEmployeeUuidForSupabase(employeeRaw);
  if (!employeeUuid) {
    console.error(
      '[LocationTask] Cannot resolve employee UUID for',
      employeeRaw,
      '— use Card No. from Employees or paste employees.id (UUID).',
    );
    return;
  }

  const payload = data as { locations?: LocationObject[] } | undefined;
  const locations = payload?.locations ?? [];
  const latestLocation = locations[locations.length - 1];

  if (!latestLocation) return;

  const { error: writeError } = await supabase
    .from('employee_locations')
    .upsert(
      {
        employee_id: employeeUuid,
        lat: latestLocation.coords.latitude,
        lng: latestLocation.coords.longitude,
        accuracy: latestLocation.coords.accuracy,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id' },
    );

  if (writeError) {
    console.error('[LocationTask] Supabase write failed:', writeError.message);
    return;
  }

  console.log('[LocationTask] Location synced for employee', employeeUuid);
});
