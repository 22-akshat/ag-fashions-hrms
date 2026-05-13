import { compareFaceEmbeddings } from '../modules/face/lib/faceMatcher';
import { devSkipFaceMatch, faceMatchThreshold } from './faceEnv';
import { NoFaceInImageError, embeddingFromPhotoUri } from './mobileFaceNet';

const EMBEDDING_DIM = 192;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function buildDeterministicEmbedding(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: EMBEDDING_DIM }, (_, i) => {
    const v = Math.sin((hash + i * 31) * 0.0000017) * 0.5 + 0.5;
    return clamp01(v);
  });
}

async function detectEmbeddingFromImage(photoUri: string): Promise<number[] | null> {
  const uri = String(photoUri ?? '').trim();
  if (!uri) return null;

  try {
    return await embeddingFromPhotoUri(uri);
  } catch (e) {
    if (e instanceof NoFaceInImageError) {
      throw e;
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('detectEmbeddingFromImage', e);
    }
    return null;
  }
}

export type ExtractEmbeddingOptions = {
  /**
   * Stable id for dev stub vectors (`emp:<seed>`) so registration / login / scan all agree
   * while native ML is unavailable. Use HR employee id when known.
   */
  devTemplateSeed?: string;
};

export async function applyFaceDetectionConfig(): Promise<void> {
  // Reserved for native tuning hooks.
}

export async function extractRegistrationEmbedding(
  photoUri: string,
  options?: ExtractEmbeddingOptions,
): Promise<number[] | null> {
  const uri = String(photoUri ?? '').trim();
  if (!uri) return null;

  try {
    const nativeEmbedding = await detectEmbeddingFromImage(uri);
    if (nativeEmbedding?.length) {
      return nativeEmbedding;
    }
  } catch (e) {
    if (e instanceof NoFaceInImageError) {
      return null;
    }
    throw e;
  }

  const allowStub =
    (typeof __DEV__ !== 'undefined' && __DEV__) || devSkipFaceMatch;
  if (!allowStub) {
    return null;
  }

  const seed =
    options?.devTemplateSeed != null && String(options.devTemplateSeed).trim() !== ''
      ? `emp:${String(options.devTemplateSeed).trim()}`
      : `dev:${uri}`;
  return buildDeterministicEmbedding(seed);
}

export async function verifyScanAgainstEmbedding(
  storedEmbedding: number[],
  currentPhotoUri: string,
  options?: ExtractEmbeddingOptions,
): Promise<void> {
  const fresh = await extractRegistrationEmbedding(currentPhotoUri, options);
  if (!fresh?.length) {
    throw new Error('Face not detected');
  }
  const compared = compareFaceEmbeddings(storedEmbedding, fresh);
  if (!Number.isFinite(compared.score) || compared.score < faceMatchThreshold) {
    throw new Error('Face mismatch');
  }
}
