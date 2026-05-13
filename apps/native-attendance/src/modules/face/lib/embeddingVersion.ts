export const CURRENT_FACE_EMBEDDING_VERSION = 2;

export function normalizeEmbeddingVersion(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : CURRENT_FACE_EMBEDDING_VERSION;
}
