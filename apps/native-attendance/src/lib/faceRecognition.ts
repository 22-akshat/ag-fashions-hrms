import { compareFaceEmbeddings } from '../modules/face/lib/faceMatcher';
import { faceCosineThreshold } from './faceEnv';
import { NoFaceInImageError, embeddingFromPhotoUri } from './enterpriseFacePipeline';

async function detectEmbeddingFromImage(photoUri: string): Promise<number[] | null> {
  const uri = String(photoUri ?? '').trim();
  if (!uri) return null;

  try {
    return await embeddingFromPhotoUri(uri);
  } catch (e) {
    if (e instanceof NoFaceInImageError) {
      throw e;
    }
    return null;
  }
}

export async function applyFaceDetectionConfig(): Promise<void> {
  // Reserved for runtime tuning via native options / remote config.
}

export async function extractRegistrationEmbedding(photoUri: string): Promise<number[] | null> {
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

  return null;
}

export async function verifyScanAgainstEmbedding(
  storedEmbedding: number[],
  currentPhotoUri: string,
): Promise<void> {
  const fresh = await extractRegistrationEmbedding(currentPhotoUri);
  if (!fresh?.length) {
    throw new Error('Face not detected');
  }
  const compared = compareFaceEmbeddings(storedEmbedding, fresh);
  if (!Number.isFinite(compared.score) || compared.score < faceCosineThreshold) {
    throw new Error('Face mismatch');
  }
}
