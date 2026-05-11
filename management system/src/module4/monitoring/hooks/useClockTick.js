import { useEffect, useState } from 'react'
import { FRESHNESS_TICK_MS } from '@/module4/monitoring/lib/constants'

/** Monotonic tick + wall clock for time-based freshness without calling Date.now() during render. */
export function useClockTick() {
  const [state, setState] = useState(() => ({ tick: 0, nowMs: Date.now() }))
  useEffect(() => {
    const id = window.setInterval(() => {
      setState((s) => ({ tick: s.tick + 1, nowMs: Date.now() }))
    }, FRESHNESS_TICK_MS)
    return () => window.clearInterval(id)
  }, [])
  return state
}
