import { NativeModules, Platform } from 'react-native';

export class NoFaceInImageError extends Error {
  constructor(message = 'No face detected in image') {
    super(message);
    this.name = 'NoFaceInImageError';
  }
}

type FaceBiometricsNative = {
  extractEmbedding: (
    uri: string,
    options?: Record<string, number>,
  ) => Promise<{
    embedding: number[];
    liveScore: number;
    detScore: number;
    embeddingDim: number;
    timingMs: number;
  }>;
};

/** ArcFace ONNX export dimension (InsightFace W600K R50 is typically 512-D). */
export const EXPECTED_EMBEDDING_DIM = 512;

function mapNativeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/NO_FACE|NO_LANDMARKS/i.test(msg)) {
    return new NoFaceInImageError();
  }
  return e instanceof Error ? e : new Error(msg);
}

/**
 * Android ONNX Mobile pipeline: SCRFD → silent anti-spoof → 5-pt align → ArcFace (normalized).
 */
export async function embeddingFromPhotoUri(photoUri: string): Promise<number[]> {
  const uri = String(photoUri ?? '').trim();
  if (!uri) {
    throw new Error('Missing photo URI');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Enterprise ONNX face pipeline is implemented on Android only.');
  }

  const native = NativeModules.FaceBiometrics as FaceBiometricsNative | undefined;
  if (!native?.extractEmbedding) {
    throw new Error('FaceBiometrics native module is not linked. Rebuild the Android app.');
  }

  try {
    const res = await native.extractEmbedding(uri, {});
    const emb = res.embedding;
    if (!emb?.length) {
      throw new Error('Empty embedding from native pipeline');
    }
    return emb;
  } catch (e) {
    throw mapNativeError(e);
  }
}
