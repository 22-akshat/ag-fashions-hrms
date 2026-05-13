/** Max age of last GPS fix to treat device as "online" (ms). */
export const ONLINE_THRESHOLD_MS = 10 * 60 * 1000

/** Beyond this age with no newer fix, treat as "offline" (ms). */
export const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000

/** Interval to re-evaluate time-based freshness in the UI (ms). */
export const FRESHNESS_TICK_MS = 60 * 1000
