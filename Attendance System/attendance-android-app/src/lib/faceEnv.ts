import Constants, { ExecutionEnvironment } from 'expo-constants';

export const devSkipFaceMatch =
  process.env.EXPO_PUBLIC_DEV_SKIP_FACE_MATCH === 'true' ||
  process.env.EXPO_PUBLIC_DEV_SKIP_FACE_MATCH === '1';

/** True when opened in the Expo Go app (no custom native code like ExpoFaceDetection). */
export const runsInExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const enableLiveness =
  process.env.EXPO_PUBLIC_ENABLE_LIVENESS === 'true' ||
  process.env.EXPO_PUBLIC_ENABLE_LIVENESS === '1';

export function parseThreshold(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
