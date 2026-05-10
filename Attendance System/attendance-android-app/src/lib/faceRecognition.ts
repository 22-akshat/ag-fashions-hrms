import { readAsStringAsync } from 'expo-file-system/legacy';
import { devSkipFaceMatch, enableLiveness, parseThreshold, runsInExpoGo } from './faceEnv';

const FACE_BUILD_HELP =
  'Face recognition needs the native ExpoFaceDetection module (not in Expo Go). ' +
  'Either set EXPO_PUBLIC_DEV_SKIP_FACE_MATCH=true in .env and restart Metro, ' +
  'or run: npx expo prebuild && npx expo run:android';

async function uriToBase64(uri: string): Promise<string> {
  return readAsStringAsync(uri, { encoding: 'base64' });
}

type FaceDetectionModule = typeof import('expo-face-detection');

let cachedFaceModule: FaceDetectionModule | undefined;
let faceModuleLoadError: Error | undefined;

async function loadFaceDetection(): Promise<FaceDetectionModule> {
  if (cachedFaceModule) return cachedFaceModule;
  if (faceModuleLoadError) throw faceModuleLoadError;

  try {
    cachedFaceModule = await import('expo-face-detection');
    return cachedFaceModule;
  } catch (e) {
    const original = e instanceof Error ? e.message : String(e);
    faceModuleLoadError = new Error(`${FACE_BUILD_HELP}\n(${original})`);
    throw faceModuleLoadError;
  }
}

/** Call once after native module loads; safe to call multiple times. */
export async function applyFaceDetectionConfig() {
  if (devSkipFaceMatch || runsInExpoGo) return;
  try {
    const FD = await loadFaceDetection();
    const matchT = parseThreshold(process.env.EXPO_PUBLIC_FACE_MATCH_THRESHOLD, Number.NaN);
    if (!Number.isNaN(matchT)) FD.setMatchThreshold(matchT);
    const liveT = parseThreshold(process.env.EXPO_PUBLIC_LIVENESS_THRESHOLD, Number.NaN);
    if (!Number.isNaN(liveT)) FD.setLivenessThreshold(liveT);
    const sharpT = parseThreshold(process.env.EXPO_PUBLIC_SHARPNESS_THRESHOLD, Number.NaN);
    if (!Number.isNaN(sharpT)) FD.setSharpnessThreshold(sharpT);
  } catch {
    // Missing native module (e.g. Expo Go): avoid crashing the shell; screens show guidance.
  }
}

export async function extractRegistrationEmbedding(
  imageUri: string,
): Promise<number[] | null> {
  if (devSkipFaceMatch) return null;
  const FD = await loadFaceDetection();
  const base64 = await uriToBase64(imageUri);
  const result = await FD.extractEmbedding(base64);
  if (!result.success || !result.embedding?.length) {
    throw new Error(result.errorMessage || 'Could not read face embedding. Face the camera clearly.');
  }
  return result.embedding;
}

export async function verifyScanAgainstEmbedding(
  embedding: number[],
  imageUri: string,
): Promise<{ confidence: number; distance: number }> {
  if (devSkipFaceMatch) {
    return { confidence: 0, distance: Number.NaN };
  }

  const FD = await loadFaceDetection();
  const base64 = await uriToBase64(imageUri);

  if (enableLiveness) {
    const live = await FD.checkLiveness(base64);
    if (!live.faceDetected || !live.isLive) {
      throw new Error(live.errorMessage || 'Live face check failed. Avoid photos or screens.');
    }
  }

  try {
    FD.setTargetEmbedding(embedding);
    const match = await FD.processFrame(base64);
    if (!match.faceDetected) {
      throw new Error(match.errorMessage || 'No face detected.');
    }
    if (!match.isMatch) {
      throw new Error('Face did not match registered employee. Try again in good lighting.');
    }
    return { confidence: match.confidence, distance: match.distance };
  } finally {
    FD.clearTarget();
  }
}
