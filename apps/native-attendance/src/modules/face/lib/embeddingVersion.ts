/** Bumped when embedding geometry/model changes (v3 = SCRFD + ArcFace ONNX 512-D). */
export const CURRENT_FACE_EMBEDDING_VERSION = 3;

export function normalizeEmbeddingVersion(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : CURRENT_FACE_EMBEDDING_VERSION;
}
