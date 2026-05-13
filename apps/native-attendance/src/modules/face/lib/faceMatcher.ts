export type EmbeddingCompareResult = {
  /** Cosine similarity in [-1, 1] for L2-normalized ArcFace vectors (typically treat ≥ threshold as match). */
  score: number;
  /** Complementary distance (1 − cosine) when vectors are normalized — informational only. */
  distance: number;
};

/**
 * Cosine similarity between L2-normalized embeddings (preferred for ArcFace).
 */
export function compareFaceEmbeddings(a: number[], b: number[]): EmbeddingCompareResult {
  const n = Math.min(a.length, b.length);
  if (n === 0) return { score: Number.NaN, distance: Number.NaN };
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  const cosine = denom > 1e-12 ? dot / denom : 0;
  return { score: cosine, distance: 1 - cosine };
}
