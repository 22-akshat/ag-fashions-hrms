import { useCallback, useEffect, useState } from 'react';

import { syncOfflineAttendanceQueue } from '../lib/offlineSync';

export function useOfflineSync() {
  const [syncing, setSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await syncOfflineAttendanceQueue();
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void syncNow();
    }, 45_000);
    return () => clearInterval(timer);
  }, [syncNow]);

  return { syncing, syncNow };
}
