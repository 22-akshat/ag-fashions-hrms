export function nextRetryIso(retries: number): string {
  const baseMs = 5000;
  const capMs = 5 * 60 * 1000;
  const wait = Math.min(capMs, baseMs * 2 ** Math.max(0, retries));
  return new Date(Date.now() + wait).toISOString();
}

export function isExpired(capturedAtIso: string, hours = 12): boolean {
  const ts = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > hours * 3600 * 1000;
}

export function canRetry(nextRetryAt: string | null): boolean {
  if (!nextRetryAt) return true;
  return new Date(nextRetryAt).getTime() <= Date.now();
}
