export function signOfflinePayload(input: Record<string, unknown>, deviceId: string): string {
  const raw = JSON.stringify(input) + '::' + deviceId;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v1_${(hash >>> 0).toString(16)}`;
}
