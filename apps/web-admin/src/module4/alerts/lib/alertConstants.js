/** Max interval between two fixes to treat as "same burst" for rapid-movement (ms). */
export const RAPID_MOVEMENT_MAX_DELTA_MS = 3 * 60 * 1000

/** Minimum straight-line jump to flag as rapid (meters). ~83 km/h sustained if 3 min — tune for your ops. */
export const RAPID_MOVEMENT_MIN_METERS = 4000
