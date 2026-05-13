import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { calculateAttendanceRisk } from '@ag-fashions/shared/security';
import { evaluateSecurityPolicy } from '@ag-fashions/shared/security-v2/policyEngine';
import FaceCamera from '../components/FaceCamera';
import { useApp } from '../context/AppContext';
import { classifyAttendanceError, markAttendance } from '../lib/attendanceApi';
import { getOrCreateDeviceInstallId } from '../lib/deviceId';
import { devSkipFaceMatch } from '../lib/faceEnv';
import { verifyScanAgainstEmbedding } from '../lib/faceRecognition';
import { verifyGeofence } from '../lib/locationChecker';
import { resolveEmployeeUuidForSupabase } from '../lib/employeeIdResolve';
import { resolveActiveGeofence } from '../lib/shopGeofence';
import { startTracking } from '../locationService';
import { useLivenessCheck } from '../modules/face/hooks/useLivenessCheck';
import { CURRENT_FACE_EMBEDDING_VERSION } from '../modules/face/lib/embeddingVersion';
import { useDeviceIntegrity } from '../modules/security/hooks/useDeviceIntegrity';
import { enqueueOfflineItem } from '../modules/offline/lib/offlineQueue';
import { useOfflineSync } from '../modules/offline/hooks/useOfflineSync';
import { useAttestation } from '../modules/enterprise-security/hooks/useAttestation';
import { useDeviceIdentity } from '../modules/enterprise-security/hooks/useDeviceIdentity';
import { useSecurityPolicy } from '../modules/enterprise-security/hooks/useSecurityPolicy';
import { signOfflinePayloadV2 } from '../modules/enterprise-security/offline-crypto/offlineSigner';
import { supabase } from '../supabase';
import { hrTheme } from '../theme/hrTheme';

export default function ScanScreen() {
  const {
    employeeId,
    registeredFaceUri,
    registeredFaceEmbedding,
    setFaceSession,
    shopFence,
    shopFenceLoading,
    shopFenceError,
    refreshShopFence,
    setStage,
    punchIntent,
    setPunchIntent,
    setLastSuccessfulPunchType,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const live = useLivenessCheck();
  const integrity = useDeviceIntegrity();
  const { syncNow } = useOfflineSync();
  const attestation = useAttestation();
  const identity = useDeviceIdentity();
  const policy = useSecurityPolicy();

  const handleScan = async (currentFaceUri: string) => {
    if (!employeeId || !registeredFaceUri) {
      Alert.alert('Registration missing', 'Please complete registration first.');
      setStage('register');
      return;
    }

    setBusy(true);
    try {
      const shopRow = await refreshShopFence();
      const activeFence = resolveActiveGeofence(shopRow);
      const geofence = await verifyGeofence(activeFence);
      if (!geofence.inside) {
        Alert.alert(
          'Outside office zone',
          `You are about ${Math.round(geofence.distanceMeters)}m from the office.`,
        );
        return;
      }

      if (devSkipFaceMatch) {
        Alert.alert(
          'Face verification disabled',
          'Dev skip is enabled. This phase requires a face verification session token.',
        );
        return;
      } else {
        if (!registeredFaceEmbedding?.length) {
          Alert.alert(
            'Missing face embedding',
            'Register again with a proper build, or enable dev skip in .env for testing.',
          );
          setStage('register');
          return;
        }
        if (live.phase === 'idle') live.start();
        if (!live.isReadyForSession) {
          await live.addFrame(currentFaceUri);
          return;
        }

        try {
          await verifyScanAgainstEmbedding(registeredFaceEmbedding, currentFaceUri);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Face verification failed';
          try {
            if (supabase) {
              const deviceId = await getOrCreateDeviceInstallId();
              const employeeUuid = await resolveEmployeeUuidForSupabase(employeeId);
              if (employeeUuid) {
                await supabase.rpc('mobile_record_face_verification_failure', {
                  p_employee_id: employeeUuid,
                  p_device_id: deviceId,
                  p_reason: 'VERIFY_FAILED',
                  p_metadata: {
                    source: 'scan',
                    liveness_ok: Boolean(live.isReadyForSession),
                    liveness: live.result ?? null,
                  },
                });
              }
            }
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
      }

      const integrityResult = await integrity.run({
        mocked: false,
        accuracy: geofence.accuracy ?? null,
      });
      if (integrityResult.classification.status === 'fail') {
        const reason = integrityResult.classification.reasons[0] ?? 'device_integrity_failed';
        Alert.alert('Device integrity failed', `Attendance blocked (${reason}). Contact HR.`);
        return;
      }

      if (!supabase) throw new Error('Supabase configuration missing in .env.');
      const deviceId = await getOrCreateDeviceInstallId();
      const [attestationResult, identityCtx, activePolicy] = await Promise.all([
        attestation.refresh(),
        identity.load(),
        policy.refresh(),
      ]);
      const policyDecision = evaluateSecurityPolicy({
        policy: activePolicy,
        signals: {
          emulator: integrityResult.snapshot.emulator,
          vpn: integrityResult.snapshot.vpn,
          root: integrityResult.snapshot.rooted,
          mock_gps: integrityResult.snapshot.mockGps,
          attestation_failure: !attestationResult.isValid,
          anomaly_score: integrityResult.classification.riskScore,
        },
      });
      if (policyDecision.decision === 'block') {
        Alert.alert('Policy blocked', `Security policy blocked attendance: ${policyDecision.blocks.join(', ')}`);
        return;
      }
      const employeeUuid = await resolveEmployeeUuidForSupabase(employeeId);
      if (!employeeUuid) {
        throw new Error(
          'Employee not found. Enter the same Card No. as in Employees (or the full UUID).',
        );
      }
      const { data: session, error: sessionErr } = await supabase.rpc(
        'mobile_create_face_verification_session',
        {
          p_employee_id: employeeUuid,
          p_device_id: deviceId,
          p_verification_score: null,
          p_expires_in_seconds: 120,
          p_metadata: {
            source: 'scan',
            liveness: {
              ok: true,
              challenge: live.challenge?.type ?? null,
              confidence: live.result?.confidence ?? null,
              metrics: live.result?.metrics ?? null,
            },
            integrity: integrityResult.snapshot,
            integrity_classification: integrityResult.classification,
          },
          p_embedding_version: CURRENT_FACE_EMBEDDING_VERSION,
        },
      );
      if (sessionErr) throw new Error(sessionErr.message);
      const token = (session as { session_token?: string } | null)?.session_token?.trim();
      const expiresAt = (session as { expires_at?: string } | null)?.expires_at ?? null;
      if (!token) throw new Error('Face session token not returned by server.');
      setFaceSession(token, typeof expiresAt === 'string' ? expiresAt : null);

      const risk = calculateAttendanceRisk({
        gpsMismatch: false,
        rapidMovement: false,
        rooted: integrityResult.snapshot.rooted,
        emulator: integrityResult.snapshot.emulator,
        vpn: integrityResult.snapshot.vpn,
        mockGps: integrityResult.snapshot.mockGps,
        blockedDevice: false,
        staleDevice: false,
        suspiciousIp: false,
        integrityUnavailable: integrityResult.snapshot.integrityUnavailable,
        repeatedFailures: 0,
        newDevice: false,
      });

      const signedPayload = {
        employee_id: employeeId,
        device_id: deviceId,
        shop_id: shopRow?.id ?? null,
        captured_at: new Date().toISOString(),
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        offline_id: null,
      };
      const deviceSignature = signOfflinePayloadV2({
        payload: signedPayload,
        privateKey: identityCtx.privateKey,
        installId: identityCtx.fingerprint.installId,
        deviceId,
        timestamp: String(signedPayload.captured_at),
      });

      const punchType = punchIntent ?? 'in';
      const dayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const idempotencyKey = `${employeeUuid}:${dayKey}:${punchType}`;

      try {
        await markAttendance({
          employeeId,
          faceSessionToken: token,
          deviceId,
          embeddingVersion: CURRENT_FACE_EMBEDDING_VERSION,
          scanLatitude: geofence.latitude,
          scanLongitude: geofence.longitude,
          shopId: shopRow?.id ?? null,
          punchType,
          idempotencyKey,
          integritySnapshot: integrityResult.snapshot as unknown as Record<string, unknown>,
          riskSnapshot: risk as unknown as Record<string, unknown>,
          attestationToken: attestationResult.integrityToken,
          attestationValid: attestationResult.isValid,
          devicePublicKey: identityCtx.publicKey,
          deviceSignature,
        });
      } catch (markErr) {
        const errMsg = markErr instanceof Error ? markErr.message : String(markErr);
        const classified = classifyAttendanceError(errMsg);
        if (classified.kind === 'network') {
          const offlineId =
            (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
            `${Date.now()}_${Math.random()}`;
          const payload = {
            offline_id: offlineId,
            employee_id: employeeId,
            device_id: deviceId,
            shop_id: shopRow?.id ?? '',
            captured_at: new Date().toISOString(),
            integrity_snapshot: integrityResult.snapshot as unknown as Record<string, unknown>,
            embedding_version: CURRENT_FACE_EMBEDDING_VERSION,
            liveness_passed: true,
            locally_verified: true,
            risk_snapshot: risk as unknown as Record<string, unknown>,
            attestation_token: attestationResult.integrityToken,
            attestation_valid: attestationResult.isValid,
            device_public_key: identityCtx.publicKey,
          };
          const signature = signOfflinePayloadV2({
            payload,
            privateKey: identityCtx.privateKey,
            installId: identityCtx.fingerprint.installId,
            deviceId,
            timestamp: payload.captured_at,
          });
          await enqueueOfflineItem({
            ...payload,
            signature,
            lat: geofence.latitude,
            lng: geofence.longitude,
            punch_type: punchType,
            idempotency_key: idempotencyKey,
            retries: 0,
            next_retry_at: null,
          });
          Alert.alert(
            'Offline queued',
            'Network unavailable. Verified attendance is queued and will sync automatically.',
          );
          void syncNow();
          setFaceSession(null, null);
          live.reset();
          await startTracking(employeeId);
          setLastSuccessfulPunchType(punchType);
          setPunchIntent(null);
          setStage('success');
          return;
        } else {
          throw markErr;
        }
      }

      setFaceSession(null, null);
      live.reset();
      await startTracking(employeeId);
      setLastSuccessfulPunchType(punchType);
      setPunchIntent(null);
      setStage('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attendance failed';
      const info = classifyAttendanceError(message);
      if (info.kind === 'network') {
        Alert.alert('Network issue', 'Could not reach server. Check network and try again.');
      } else if (info.kind === 'expired') {
        Alert.alert('Face session expired', 'Please scan again to re-verify.');
        live.reset();
      } else if (info.kind === 'used') {
        Alert.alert('Face session already used', 'Please scan again.');
        live.reset();
      } else if (info.kind === 'device_blocked') {
        Alert.alert('Device blocked', 'This device is blocked or not approved. Contact HR.');
      } else if (info.kind === 'rate_limited') {
        Alert.alert('Too many attempts', 'Please wait a bit and try again.');
      } else if (info.kind === 'embedding_mismatch') {
        Alert.alert('Face template outdated', 'Re-enroll face on this device (Face & device enrollment).');
      } else if (info.kind === 'device_integrity_failed') {
        Alert.alert('Integrity blocked', 'This device failed integrity checks. Contact HR.');
      } else if (info.kind === 'mock_location') {
        Alert.alert('Mock location blocked', 'Disable mock location and try again.');
      } else if (info.kind === 'emulator_not_allowed') {
        Alert.alert('Emulator blocked', 'Attendance is not allowed on emulator devices.');
      } else if (info.kind === 'device_revoked') {
        Alert.alert('Device revoked', 'This device has been revoked. Please sign in on an approved device.');
      } else if (info.kind === 'offline_expired') {
        Alert.alert('Offline attempt expired', 'Queued attendance expired (older than 12h). Please re-scan.');
      } else if (info.kind === 'offline_replay') {
        Alert.alert('Replay blocked', 'This offline attendance payload was already used.');
      } else if (info.kind === 'offline_signature_invalid') {
        Alert.alert('Offline payload invalid', 'Offline payload signature was invalid.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const geofenceStatusLine = shopFence
    ? `${shopFence.name?.trim() || 'Store'} (${Math.round(shopFence.radiusMeters)} m) — from Supabase shops`
    : shopFenceError
      ? `Store DB error: ${shopFenceError}`
      : resolveActiveGeofence(null)
        ? 'Using .env lat/lng (fallback; no shops row)'
        : 'No geofence configured — attendance allowed everywhere';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Mark Attendance</Text>
      {punchIntent ? (
        <Text style={styles.punchBanner}>Punch: {punchIntent === 'out' ? 'MARK OUT' : 'MARK IN'}</Text>
      ) : null}
      <Text style={styles.subtitle}>Employee (card no. / UUID): {employeeId || 'Not set'}</Text>
      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color="#0d9488" />
          <Text style={styles.busyText}>Verifying face and posting attendance…</Text>
        </View>
      ) : null}
      {shopFenceLoading ? (
        <View style={styles.storeRow}>
          <ActivityIndicator size="small" color="#22c55e" />
          <Text style={styles.storeMeta}> Loading store GPS from Supabase…</Text>
        </View>
      ) : (
        <Text style={styles.storeMeta}>{geofenceStatusLine}</Text>
      )}
      {devSkipFaceMatch ? (
        <Text style={styles.notice}>
          Dev skip is enabled. Phase-2 requires a server-issued face session token; attendance will be blocked
          until face matching is enabled.
        </Text>
      ) : null}
      {live.challenge ? (
        <Text style={styles.notice}>
          Liveness: {live.instruction} {live.progressText ? `(${live.progressText})` : ''}
        </Text>
      ) : null}
      {live.error ? <Text style={styles.notice}>{live.error}</Text> : null}
      <FaceCamera
        onPhotoTaken={(uri) => void handleScan(uri)}
        disabled={busy || shopFenceLoading}
      />
      {!live.isReadyForSession ? (
        <Pressable
          style={[styles.altButton, busy ? styles.disabled : null]}
          onPress={() => live.retry()}
          disabled={busy}
        >
          <Text style={styles.altButtonText}>Retry liveness</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.altButton, busy ? styles.disabled : null]}
        onPress={() => setStage('register')}
        disabled={busy}
      >
        <Text style={styles.altButtonText}>Go to Register</Text>
      </Pressable>
      <Pressable
        style={[styles.altButton, busy ? styles.disabled : null]}
        onPress={() => setStage('face_verify')}
        disabled={busy}
      >
        <Text style={styles.altButtonText}>Verify face (lab)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: hrTheme.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: hrTheme.navyTitle,
  },
  punchBanner: {
    fontSize: 13,
    fontWeight: '800',
    color: hrTheme.navyTitle,
    backgroundColor: hrTheme.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  subtitle: {
    color: hrTheme.textMuted,
    fontSize: 14,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: hrTheme.surfaceElevated,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  busyText: { fontSize: 13, fontWeight: '600', color: hrTheme.navyMuted, flex: 1 },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeMeta: {
    fontSize: 12,
    color: hrTheme.navyMuted,
    lineHeight: 18,
  },
  notice: {
    color: hrTheme.navyMuted,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: hrTheme.warningBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hrTheme.warningBorder,
    padding: 8,
  },
  altButton: {
    borderWidth: 1,
    borderColor: hrTheme.border,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: hrTheme.surface,
  },
  altButtonText: {
    color: hrTheme.navyMuted,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.65,
  },
});
