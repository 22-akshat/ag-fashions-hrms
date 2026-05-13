import { useCallback, useState } from 'react';

import { getDeviceIdentityContext } from '../device-identity/deviceIdentityProvider';

export function useDeviceIdentity() {
  const [identity, setIdentity] = useState<Awaited<ReturnType<typeof getDeviceIdentityContext>> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = await getDeviceIdentityContext();
      setIdentity(ctx);
      return ctx;
    } finally {
      setLoading(false);
    }
  }, []);

  return { identity, loading, load };
}
