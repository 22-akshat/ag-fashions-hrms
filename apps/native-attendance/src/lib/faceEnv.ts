/** Bare RN build — not Expo Go. Kept for UI copy that referenced Expo Go. */
export const runsInExpoGo = false;

export const devSkipFaceMatch =
  String(process.env.EXPO_PUBLIC_DEV_SKIP_FACE_MATCH ?? 'false').trim().toLowerCase() === 'true';

export const enableLiveness =
  String(process.env.EXPO_PUBLIC_ENABLE_LIVENESS ?? 'false').trim().toLowerCase() === 'true';

/** Legacy name kept for attendance RPC payloads — cosine threshold for ArcFace (0..1). */
export const faceMatchThreshold = Number(process.env.EXPO_PUBLIC_FACE_MATCH_THRESHOLD ?? 0.42);

/** Preferred ArcFace cosine gate (alias of faceMatchThreshold unless overridden). */
export const faceCosineThreshold = Number(
  (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_FACE_COSINE_THRESHOLD'] ??
    process.env.EXPO_PUBLIC_FACE_MATCH_THRESHOLD ??
    0.42,
);

export const livenessThreshold = Number(process.env.EXPO_PUBLIC_LIVENESS_THRESHOLD ?? 0.6);

export const sharpnessThreshold = Number(process.env.EXPO_PUBLIC_SHARPNESS_THRESHOLD ?? 120);
