import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { LookupEmployeeSummary } from '../lib/employeeLookup';
import { lookupEmployeeByCardNo } from '../lib/employeeLookup';
import { registerEmployeeDevice } from '../lib/deviceBinding';
import { generateFaceEmbedding } from '../lib/faceEmbedding';
import { CURRENT_FACE_EMBEDDING_VERSION } from '../lib/embeddingVersion';
import { getOrCreateDeviceInstallId } from '../../../lib/deviceId';

type Phase =
  | 'card'
  | 'review'
  | 'capturing'
  | 'confirm_replace'
  | 'saving'
  | 'done'
  | 'error';

export function useFaceRegistration() {
  const [phase, setPhase] = useState<Phase>('card');
  const [cardNo, setCardNo] = useState('');
  const [employee, setEmployee] = useState<LookupEmployeeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [replaceApproved, setReplaceApproved] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const reset = useCallback(() => {
    setPhase('card');
    setCardNo('');
    setEmployee(null);
    setError(null);
    setEmbedding(null);
    setReplaceApproved(false);
  }, []);

  const lookup = useCallback(async () => {
    setError(null);
    setLookupLoading(true);
    try {
      const row = await lookupEmployeeByCardNo(cardNo);
      if (!row) {
        setEmployee(null);
        setError('No active employee with that card number.');
        setPhase('card');
        return;
      }
      setEmployee(row);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setPhase('card');
    } finally {
      setLookupLoading(false);
    }
  }, [cardNo]);

  const startCapture = useCallback(() => {
    if (!employee) return;
    if (employee.has_registered_face && !replaceApproved) {
      setPhase('confirm_replace');
      return;
    }
    setPhase('capturing');
  }, [employee, replaceApproved]);

  const confirmReplace = useCallback(() => {
    setReplaceApproved(true);
    setPhase('capturing');
  }, []);

  const onPhotoCapture = useCallback(
    async (uri: string) => {
      if (!employee) return;
      setError(null);
      setPhase('saving');
      try {
        const emb = await generateFaceEmbedding(uri);
        setEmbedding(emb);
        const deviceId = await getOrCreateDeviceInstallId();
        await registerEmployeeDevice({
          employeeId: employee.id,
          embedding: emb,
          deviceId,
          embeddingVersion: CURRENT_FACE_EMBEDDING_VERSION,
          forceReplaceApproved: replaceApproved,
        });
        setPhase('done');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Registration failed';
        setError(msg);
        setPhase('review');
        if (msg.includes('FACE_ALREADY_REGISTERED')) {
          Alert.alert(
            'Face already registered',
            'HR data already has a face template. Confirm replace before continuing.',
          );
        }
      }
    },
    [employee, replaceApproved],
  );

  return {
    phase,
    cardNo,
    setCardNo,
    employee,
    embedding,
    error,
    replaceApproved,
    lookupLoading,
    lookup,
    startCapture,
    confirmReplace,
    cancelReplace: () => setPhase('review'),
    onPhotoCapture,
    reset,
  };
}
