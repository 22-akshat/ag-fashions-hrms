import { useCallback, useState } from 'react';

import { fetchSecurityPolicy } from '../policy-engine/securityPolicyClient';
import type { SecurityPolicy } from '../policy-engine/policyTypes';

export function useSecurityPolicy() {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchSecurityPolicy();
      setPolicy(p);
      return p;
    } finally {
      setLoading(false);
    }
  }, []);

  return { policy, loading, refresh };
}
