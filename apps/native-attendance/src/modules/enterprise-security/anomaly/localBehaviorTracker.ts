let lastScanAt: number | null = null;

export function trackLocalScanBehavior(now = Date.now()) {
  const rapid = lastScanAt !== null && now - lastScanAt < 30_000;
  lastScanAt = now;
  return { rapid };
}

export function resetLocalBehaviorTracker() {
  lastScanAt = null;
}
