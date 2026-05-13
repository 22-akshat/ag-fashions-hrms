import { devSkipFaceMatch } from '../../../lib/faceEnv';
import { extractRegistrationEmbedding } from '../../../lib/faceRecognition';

const MOCK_DIM = 192;

/**
 * Pluggable embedding pipeline — swap internals for TF / cloud without touching screens.
 */
export async function generateFaceEmbedding(
  photoUri: string,
  devTemplateSeed?: string,
): Promise<number[]> {
  const native = await extractRegistrationEmbedding(
    photoUri,
    devTemplateSeed ? { devTemplateSeed } : undefined,
  );
  if (native?.length) {
    return native;
  }

  if (devSkipFaceMatch || !native) {
    return Array.from({ length: MOCK_DIM }, (_, i) => Math.sin((i + 1) * 0.13) * 0.5);
  }

  throw new Error('Unable to derive face embedding from this capture.');
}
