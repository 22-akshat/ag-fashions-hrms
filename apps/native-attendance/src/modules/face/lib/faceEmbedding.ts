import { extractRegistrationEmbedding } from '../../../lib/faceRecognition';

/**
 * Face embedding entry point for registration / verification screens.
 * Uses Android ONNX pipeline (SCRFD + silent FAS + ArcFace).
 */
export async function generateFaceEmbedding(photoUri: string): Promise<number[]> {
  const native = await extractRegistrationEmbedding(photoUri);
  if (native?.length) {
    return native;
  }
  throw new Error('Unable to derive face embedding from this capture.');
}
