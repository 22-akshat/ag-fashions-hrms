import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  EMPLOYEE_ID_STORAGE_KEY,
  LOCATION_INTERVAL_MS,
  LOCATION_TASK_NAME,
} from './constants';
import { hasSupabaseConfig } from './supabase';

async function ensurePermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Foreground location permission denied.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Background location permission denied.');
  }
}

export async function startTracking(employeeId: string) {
  if (!hasSupabaseConfig) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  await ensurePermissions();
  await AsyncStorage.setItem(EMPLOYEE_ID_STORAGE_KEY, employeeId);

  const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME,
  );

  if (isAlreadyRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: LOCATION_INTERVAL_MS,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Attendance tracking is active',
      notificationBody: 'Location updates are being synced for attendance.',
      notificationColor: '#2563eb',
    },
  });
}

export async function stopTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export async function getTrackingStatus() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}
