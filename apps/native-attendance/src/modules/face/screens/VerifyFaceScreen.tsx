import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardNumberForm } from '../components/CardNumberForm';
import { FaceCaptureCard } from '../components/FaceCaptureCard';
import { compareFaceEmbeddings } from '../lib/faceMatcher';
import { generateFaceEmbedding } from '../lib/faceEmbedding';
import { lookupEmployeeByCardNo } from '../lib/employeeLookup';
import type { LookupEmployeeSummary } from '../lib/employeeLookup';
import { useLivenessCheck } from '../hooks/useLivenessCheck';
import { CURRENT_FACE_EMBEDDING_VERSION } from '../lib/embeddingVersion';
import { getOrCreateDeviceInstallId } from '../../../lib/deviceId';
import { useApp } from '../../../context/AppContext';
import { supabase, hasSupabaseConfig } from '../../../supabase';
import type { AppStage } from '../../../context/AppContext';

type Props = {
  onBack: (stage: AppStage) => void;
};

function parseStoredEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return raw as number[];
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return parseStoredEmbedding(p);
    } catch {
      return null;
    }
  }
  return null;
}

/** Architecture-only probe: confirms we can reload server template & score against a capture. */
export default function VerifyFaceScreen({ onBack }: Props) {
  const { setFaceSession } = useApp();
  const [cardNo, setCardNo] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [employee, setEmployee] = useState<LookupEmployeeSummary | null>(null);
  const [stored, setStored] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const live = useLivenessCheck();

  const resetLookup = useCallback(() => {
    setEmployee(null);
    setStored(null);
    setScore(null);
    setDistance(null);
    setLoadError(null);
    setCompareBusy(false);
    setSessionToken(null);
    setSessionExpiresAt(null);
    setFaceSession(null, null);
    live.reset();
  }, [live, setFaceSession]);

  const lookup = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase client not configured.');
      return;
    }
    setLookupLoading(true);
    setLoadError(null);
    setStored(null);
    setScore(null);
    setEmployee(null);
    try {
      const row = await lookupEmployeeByCardNo(cardNo.trim());
      if (!row?.id) {
        setLoadError('No matching active employee.');
        return;
      }
      const { data, error } = await supabase.rpc('mobile_get_registered_face_embedding', {
        p_employee_id: row.id,
        p_card_no: row.card_no,
      });
      if (error) throw new Error(error.message);
      const parsed = parseStoredEmbedding(data as unknown);
      if (!parsed?.length) {
        setEmployee(row);
        setLoadError('No face template saved for this employee yet.');
        return;
      }
      setEmployee(row);
      setStored(parsed);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLookupLoading(false);
    }
  }, [cardNo]);

  const onCapture = useCallback(
    async (uri: string) => {
      if (!stored?.length) return;
      if (live.phase === 'idle') live.start();
      if (!live.isReadyForSession) {
        await live.addFrame(uri);
        return;
      }

      setCompareBusy(true);
      setScore(null);
      try {
        const sb = supabase;
        if (!sb) throw new Error('Supabase client not configured.');
        if (!employee?.id) throw new Error('Employee not loaded.');

        const fresh = await generateFaceEmbedding(uri, employee.id);
        const result = compareFaceEmbeddings(stored, fresh);
        setScore(result.score);
        setDistance(result.distance);

        const deviceId = await getOrCreateDeviceInstallId();
        const { data, error } = await sb.rpc('mobile_create_face_verification_session', {
          p_employee_id: employee.id,
          p_device_id: deviceId,
          p_verification_score: result.score,
          p_expires_in_seconds: 120,
          p_metadata: {
            source: 'verify_lab',
            liveness: {
              ok: true,
              challenge: live.challenge?.type ?? null,
              confidence: live.result?.confidence ?? null,
              metrics: live.result?.metrics ?? null,
            },
          },
          p_embedding_version: CURRENT_FACE_EMBEDDING_VERSION,
        });
        if (error) throw new Error(error.message);
        const token = (data as { session_token?: string } | null)?.session_token?.trim() ?? null;
        const expiresAt = (data as { expires_at?: string } | null)?.expires_at ?? null;
        if (!token) throw new Error('Face session token not returned by server.');
        setSessionToken(token);
        setSessionExpiresAt(typeof expiresAt === 'string' ? expiresAt : null);
        setFaceSession(token, typeof expiresAt === 'string' ? expiresAt : null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Compare failed';
        setLoadError(msg);
        try {
          const sb = supabase;
          if (sb && employee?.id) {
            const deviceId = await getOrCreateDeviceInstallId();
            await sb.rpc('mobile_record_face_verification_failure', {
              p_employee_id: employee.id,
              p_device_id: deviceId,
              p_reason: 'VERIFY_FAILED',
              p_metadata: {
                liveness_ok: Boolean(live.isReadyForSession),
                liveness: live.result ?? null,
              },
            });
          }
        } catch {
          // ignore
        }
      } finally {
        setCompareBusy(false);
      }
    },
    [employee, live, stored, setFaceSession],
  );

  const back = () => onBack('scan');

  if (!hasSupabaseConfig) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Configure Supabase to use verification lab.</Text>
        <Pressable onPress={back}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={back}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>
      <Text style={styles.h1}>Verify face (lab)</Text>
      <Text style={styles.sub}>
        Compare a fresh capture to the enrolled template returned by RPC. Threshold tuning comes in a later phase.
      </Text>

      {!stored?.length ? (
        <>
          <CardNumberForm
            value={cardNo}
            onChangeText={setCardNo}
            onLookup={() => void lookup()}
            loading={lookupLoading}
          />
          {employee ? (
            <Pressable style={styles.secondaryBtn} onPress={resetLookup}>
              <Text style={styles.secondaryBtnText}>Use different card</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {loadError ? <Text style={styles.err}>{loadError}</Text> : null}
      {live.error ? <Text style={styles.err}>{live.error}</Text> : null}

      {employee && stored?.length ? (
        <>
          <View style={styles.info}>
            <Text style={styles.name}>{employee.full_name}</Text>
            <Text style={styles.meta}>Template dims: {stored.length}</Text>
            {live.challenge ? (
              <Text style={styles.meta}>
                Liveness · {live.instruction} {live.progressText ? `(${live.progressText})` : ''}
              </Text>
            ) : (
              <Text style={styles.meta}>Liveness · Tap capture 3 times, following the instruction.</Text>
            )}
          </View>
          {compareBusy ? (
            <View style={styles.saving}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FaceCaptureCard
              onPhotoTaken={(uri) => void onCapture(uri)}
              subtitle={live.challenge ? live.instruction : 'Neutral lighting helps. Tap capture 3 times.'}
            />
          )}
          {score != null ? (
            <Text style={styles.score}>
              Similarity score: {score.toFixed(4)} · L2 distance:{' '}
              {distance != null && Number.isFinite(distance) ? distance.toFixed(4) : '—'}
            </Text>
          ) : null}
          {!live.isReadyForSession ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                live.retry();
              }}
            >
              <Text style={styles.secondaryBtnText}>Retry liveness</Text>
            </Pressable>
          ) : null}
          {sessionToken ? (
            <Text style={styles.meta}>
              Session issued (2 min): {sessionToken.slice(0, 12)}…
              {sessionExpiresAt ? ` expires ${sessionExpiresAt}` : ''}
            </Text>
          ) : null}
          <Pressable style={styles.secondaryBtn} onPress={resetLookup}>
            <Text style={styles.secondaryBtnText}>Use different card</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#f8faf8',
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  backRow: {
    alignSelf: 'flex-start',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  warn: {
    fontSize: 15,
    color: '#b45309',
    textAlign: 'center',
  },
  link: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 15,
  },
  h1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  sub: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  info: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  meta: {
    fontSize: 13,
    color: '#166534',
  },
  err: {
    color: '#b91c1c',
  },
  saving: {
    alignItems: 'center',
    marginVertical: 12,
  },
  score: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 14,
  },
});
