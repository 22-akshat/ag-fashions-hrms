const seen = new Set<string>();

export function seenOfflineId(id: string): boolean {
  return seen.has(id);
}

export function markOfflineId(id: string) {
  seen.add(id);
}

export function clearOfflineReplayGuard() {
  seen.clear();
}
