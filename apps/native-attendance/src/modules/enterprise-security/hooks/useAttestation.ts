import { useCallback, useState } from 'react';

import { collectAttestation, type AttestationResult } from '../attestation/attestationService';

export function useAttestation() {
  const [attestation, setAttestation] = useState<AttestationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await collectAttestation();
      setAttestation(r);
      return r;
    } finally {
      setLoading(false);
    }
  }, []);

  return { attestation, loading, refresh };
}
