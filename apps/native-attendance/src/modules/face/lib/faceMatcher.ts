/** L2 distance between same-length embeddings. */
function l2Distance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return Number.NaN;
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export type EmbeddingCompareResult = {
  score: number;
  distance: number;
};

/**
 * Comparable score in (0..1]: higher means more similar — mapping is tunable later.
 */
export function compareFaceEmbeddings(a: number[], b: number[]): EmbeddingCompareResult {
  const distance = l2Distance(a, b);
  if (!Number.isFinite(distance)) return { score: 0, distance: Number.NaN };
  const score = 1 / (1 + distance);
  return { score, distance };
}
