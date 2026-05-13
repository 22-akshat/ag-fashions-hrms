export function deriveOfflineSigningKey(privateKey: string, installId: string): string {
  const raw = `${privateKey}::${installId}::offline`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) + hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `k_${Math.abs(hash).toString(16)}`;
}
