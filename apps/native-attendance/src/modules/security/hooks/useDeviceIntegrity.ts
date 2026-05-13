import { useCallback, useMemo, useState } from 'react';

import { runIntegrityChecks, type IntegritySnapshot } from '../lib/integrityChecks';
import { classifyIntegrity, type IntegrityClassification } from '../lib/integrityClassifier';

export function useDeviceIntegrity() {
  const [snapshot, setSnapshot] = useState<IntegritySnapshot | null>(null);
  const [classification, setClassification] = useState<IntegrityClassification | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(async (input?: { mocked?: boolean | null; accuracy?: number | null }) => {
    setChecking(true);
    try {
      const snap = await runIntegrityChecks(input);
      const cls = classifyIntegrity(snap);
      setSnapshot(snap);
      setClassification(cls);
      return { snapshot: snap, classification: cls };
    } finally {
      setChecking(false);
    }
  }, []);

  const isHardBlocked = useMemo(
    () => Boolean(classification && classification.status === 'fail'),
    [classification],
  );

  return {
    snapshot,
    classification,
    checking,
    run,
    isHardBlocked,
  };
}
