import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FaceCamera from '../components/FaceCamera';
import { useApp } from '../context/AppContext';
import { submitRegistrationAccessRequest } from '../lib/accessRequestsApi';
import { getOrCreateDeviceInstallId } from '../lib/deviceId';
import { fetchEmployeeBrief, type EmployeeBrief } from '../lib/employeeLookup';
import { extractRegistrationEmbedding } from '../lib/faceRecognition';
import {
  ensureForegroundLocationPermission,
  getCurrentPositionHighAccuracy,
} from '../lib/geoLocation';
import { fetchNearestShopForGps, type NearestShopMatch } from '../lib/shopGeofence';
import { hasSupabaseConfig } from '../supabase';
import { hrTheme } from '../theme/hrTheme';

type LocPhase = 'idle' | 'loading' | 'done';

const FACE_ANGLE_HINTS = [
  'Photo 1/4 — face the camera straight',
  'Photo 2/4 — turn head slightly left',
  'Photo 3/4 — turn head slightly right',
  'Photo 4/4 — look slightly up',
] as const;

function averageEmbedding(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const len = vectors[0]!.length;
  const out = new Array(len).fill(0);
  for (const v of vectors) {
    if (v.length !== len) throw new Error('Embedding length mismatch');
    for (let i = 0; i < len; i++) out[i] += v[i]!;
  }
  for (let i = 0; i < len; i++) out[i] /= vectors.length;
  return out;
}

export default function RegisterScreen() {
  const {
    setEmployeeId,
    setRegisteredFaceUri,
    setRegisteredFaceEmbedding,
    setStage,
  } = useApp();

  const [cardInput, setCardInput] = useState('');
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [resolvedEmployee, setResolvedEmployee] = useState<EmployeeBrief | null>(null);

  const [locPhase, setLocPhase] = useState<LocPhase>('idle');
  const [locDenied, setLocDenied] = useState(false);
  const [nearestShopLabel, setNearestShopLabel] = useState<string | null>(null);
  const [nearestShopMatch, setNearestShopMatch] = useState<NearestShopMatch | null>(null);
  const [gpsSnapshot, setGpsSnapshot] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [locLoadError, setLocLoadError] = useState<string | null>(null);

  const [faceCaptureUris, setFaceCaptureUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const trimmedCard = cardInput.trim();
  const canUseFaceCapture =
    Boolean(resolvedEmployee) &&
    locPhase === 'done' &&
    nearestShopLabel !== null &&
    !locDenied &&
    !locLoadError;

  const faceAnglesComplete = faceCaptureUris.length >= 4;
  const canSubmitRegistration = canUseFaceCapture && faceAnglesComplete;

  const loadGpsAndShopLabel = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setLocPhase('done');
      setLocLoadError('Supabase missing — cannot load store names.');
      setNearestShopMatch(null);
      setGpsSnapshot(null);
      return;
    }
    setLocPhase('loading');
    setLocDenied(false);
    setLocLoadError(null);
    setNearestShopLabel(null);
    setNearestShopMatch(null);
    setGpsSnapshot(null);

    try {
      const granted = await ensureForegroundLocationPermission();
      if (!granted) {
        setLocDenied(true);
        setNearestShopLabel(null);
        setNearestShopMatch(null);
        setGpsSnapshot(null);
        setLocPhase('done');
        return;
      }

      const pos = await getCurrentPositionHighAccuracy();
      setGpsSnapshot({
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy,
      });

      const match = await fetchNearestShopForGps(pos.latitude, pos.longitude);

      if (!match) {
        setNearestShopMatch(null);
        setNearestShopLabel('No shop locations found in the directory.');
        setLocPhase('done');
        return;
      }

      setNearestShopMatch(match);
      const name = match.shop.name?.trim() || 'Store';
      if (match.insideRadius) {
        setNearestShopLabel(`${name} • Inside store geofence`);
      } else {
        const m = Math.round(match.distanceMeters);
        setNearestShopLabel(`${name} • ~${m} m from store`);
      }
      setLocPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocLoadError(msg);
      setNearestShopLabel(null);
      setNearestShopMatch(null);
      setGpsSnapshot(null);
      setLocPhase('done');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) void loadGpsAndShopLabel();
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [loadGpsAndShopLabel]);

  useEffect(() => {
    if (!hasSupabaseConfig || !trimmedCard) {
      setResolvedEmployee(null);
      setEmployeeError(null);
      setEmployeeLoading(false);
      return;
    }

    setEmployeeLoading(true);
    setEmployeeError(null);

    const t = setTimeout(() => {
      void (async () => {
        try {
          const row = await fetchEmployeeBrief(trimmedCard);
          setResolvedEmployee(row);
          setEmployeeError(row ? null : 'No active employee found for this card in HR records.');
        } catch (err) {
          setResolvedEmployee(null);
          const message = err instanceof Error ? err.message : String(err);
          setEmployeeError(message);
        } finally {
          setEmployeeLoading(false);
        }
      })();
    }, 450);

    return () => clearTimeout(t);
  }, [trimmedCard]);

  useEffect(() => {
    setFaceCaptureUris([]);
  }, [trimmedCard, resolvedEmployee?.id]);

  const handleSave = async () => {
    if (!trimmedCard) {
      Alert.alert('Card number', 'Enter your employee card number first.');
      return;
    }
    if (!resolvedEmployee) {
      Alert.alert(
        'Employee not found',
        'Use the exact card number from HR. The employee name should appear above when valid.',
      );
      return;
    }
    if (!canUseFaceCapture) {
      if (locDenied) {
        Alert.alert(
          'Location required',
          'Enable location permission in system settings so we can match you to the correct store.',
        );
      } else if (locPhase !== 'done' || nearestShopLabel === null || locLoadError) {
        Alert.alert('Please wait', 'Allow GPS and store detection to finish before continuing.');
      }
      return;
    }
    if (!faceAnglesComplete) {
      Alert.alert('Face (4 photos)', 'Capture all 4 angles using the hints below the camera.');
      return;
    }

    setBusy(true);
    try {
      const previewUri = faceCaptureUris[3] ?? faceCaptureUris[0] ?? null;
      if (!previewUri) {
        Alert.alert('Face', 'Missing captures.');
        return;
      }

      const parts = await Promise.all(faceCaptureUris.map((u) => extractRegistrationEmbedding(u)));
      const ok = parts.filter((p): p is number[] => Boolean(p && p.length > 0));
      if (ok.length !== 4) {
        Alert.alert(
          'Face',
          'All 4 photos must produce a valid template. Improve lighting, add ONNX models (assets/models), rebuild, then tap Retake all 4.',
        );
        return;
      }
      const embedding = averageEmbedding(ok);

      if (!embedding || embedding.length === 0) {
        Alert.alert(
          'Face model unavailable',
          'Place ONNX models under android/app/src/main/assets/models/ per README and rebuild the Android app.',
        );
        return;
      }

      if (!gpsSnapshot) {
        Alert.alert(
          'Location',
          'GPS data is unavailable. Tap Refresh GPS and try again.',
        );
        return;
      }

      try {
        const deviceId = await getOrCreateDeviceInstallId();
        const accessResult = await submitRegistrationAccessRequest({
          cardNo: trimmedCard,
          requestedShopId: nearestShopMatch?.shop.id ?? null,
          lat: gpsSnapshot.lat,
          lng: gpsSnapshot.lng,
          accuracyM: gpsSnapshot.accuracy,
          deviceId,
        });
        Alert.alert(
          accessResult === 'already_pending' ? 'Already pending' : 'Sent to HR',
          accessResult === 'already_pending'
            ? 'A pending request already exists. Check dashboard for Approved / Rejected — it updates live.'
            : 'HR will review your access request. Status shows as Pending, then Approved or Rejected on your dashboard in realtime.',
        );
      } catch (accessErr) {
        const msg = accessErr instanceof Error ? accessErr.message : String(accessErr);
        Alert.alert(
          'Access request failed',
          `${msg}\n\nThe request was not saved. Check your connection and try again, or contact HR.`,
        );
        return;
      }

      await setEmployeeId(trimmedCard);
      await setRegisteredFaceUri(previewUri);
      await setRegisteredFaceEmbedding(embedding);
      setStage('dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      Alert.alert('Registration error', message);
    } finally {
      setBusy(false);
    }
  };

  const faceBlockedReason =
    resolvedEmployee &&
    !(nearestShopLabel && !locDenied && !locLoadError && locPhase === 'done')
      ? 'Enable location and wait until a store name appears from GPS before capturing your face.'
      : !resolvedEmployee
        ? trimmedCard.length > 0
          ? employeeLoading
            ? 'Looking up card…'
            : 'Enter a valid card number to load the employee name.'
          : null
        : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>HR</Text>
        </View>
        <View>
          <Text style={styles.brandSuite}>AG Fashions</Text>
          <Text style={styles.brandSub}>Employee access request</Text>
        </View>
      </View>
      <Text style={styles.title}>Registration</Text>
      <Text style={styles.stepHint}>
        1) Card → employee name · 2) GPS → store · 3) Four face photos · 4) Submit to HR
      </Text>

      <Text style={styles.hint}>
        Face templates use on-device ONNX (SCRFD + anti-spoof + ArcFace). Requires rebuilt Android APK with
        model assets.
      </Text>

      <Text style={styles.fieldLabel}>Card number</Text>
      <TextInput
        placeholder="As recorded in Employees (HR)"
        style={styles.input}
        value={cardInput}
        onChangeText={setCardInput}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>Employee name</Text>
      <View style={styles.infoCard}>
        {employeeLoading ? (
          <ActivityIndicator />
        ) : resolvedEmployee ? (
          <Text style={styles.infoValue}>{resolvedEmployee.full_name}</Text>
        ) : trimmedCard.length > 0 ? (
          <Text style={styles.infoWarn}>{employeeError ?? '—'}</Text>
        ) : (
          <Text style={styles.placeholder}>Name appears here after a valid card is entered</Text>
        )}
      </View>

      <Text style={styles.fieldLabel}>Store (GPS + directory)</Text>
      <View style={styles.infoCard}>
        {locPhase === 'loading' ? (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.infoMeta}>Acquiring GPS and matching nearest store…</Text>
          </View>
        ) : locDenied ? (
          <Text style={styles.infoWarn}>Location permission denied — enable it in Settings</Text>
        ) : locLoadError ? (
          <Text style={styles.infoWarn}>{locLoadError}</Text>
        ) : nearestShopLabel ? (
          <Text style={styles.infoValue}>{nearestShopLabel}</Text>
        ) : (
          <Text style={styles.placeholder}>Unknown</Text>
        )}
        <Pressable
          style={styles.refreshMini}
          onPress={() => void loadGpsAndShopLabel()}
          disabled={busy || locPhase === 'loading'}
        >
          <Text style={styles.refreshMiniText}>Refresh GPS</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>Face (4 photos for HR request)</Text>
      {faceBlockedReason ? (
        <Text style={styles.blockHint}>{faceBlockedReason}</Text>
      ) : null}
      {canUseFaceCapture ? (
        <Text style={styles.angleHint}>
          {faceAnglesComplete
            ? 'All 4 photos captured — submit below.'
            : FACE_ANGLE_HINTS[faceCaptureUris.length] ?? ''}
        </Text>
      ) : null}
      <FaceCamera
        onPhotoTaken={(uri) => {
          setFaceCaptureUris((prev) => (prev.length >= 4 ? prev : [...prev, uri]));
        }}
        disabled={busy || !canUseFaceCapture || faceAnglesComplete}
      />
      {faceCaptureUris.length > 0 ? (
        <View style={styles.thumbRow}>
          {faceCaptureUris.map((uri, i) => (
            <View key={`${i}-${uri.slice(-12)}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              <Text style={styles.thumbIdx}>{i + 1}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {canUseFaceCapture && !faceAnglesComplete ? (
        <Text style={styles.meta}>Tap capture for each angle until 4 thumbnails appear.</Text>
      ) : null}
      {faceAnglesComplete ? (
        <Text style={styles.meta}>Ready to submit access request to HR.</Text>
      ) : null}
      {canUseFaceCapture ? (
        <Pressable
          style={styles.refreshMini}
          onPress={() => setFaceCaptureUris([])}
          disabled={busy || faceCaptureUris.length === 0}
        >
          <Text style={styles.refreshMiniText}>Retake all 4</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.button, busy || !canSubmitRegistration ? styles.disabled : null]}
        onPress={() => void handleSave()}
        disabled={busy || !canSubmitRegistration}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit HR request & open dashboard</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondaryNav, busy ? styles.disabled : null]}
        onPress={() => setStage('face_register')}
        disabled={busy}
      >
        <Text style={styles.secondaryNavText}>Face & device enrollment (HR template)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: hrTheme.bg },
  wrap: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: hrTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hrTheme.border,
    padding: 12,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: hrTheme.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  brandSuite: { fontSize: 15, fontWeight: '800', color: hrTheme.navyTitle },
  brandSub: { fontSize: 11, fontWeight: '600', color: hrTheme.textMuted, letterSpacing: 0.3 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: hrTheme.navyTitle,
  },
  stepHint: {
    fontSize: 13,
    color: hrTheme.textMuted,
    lineHeight: 18,
  },
  hint: {
    color: hrTheme.navyMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    color: hrTheme.navyMuted,
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: hrTheme.warningBg,
    borderWidth: 1,
    borderColor: hrTheme.warningBorder,
    borderRadius: 10,
    padding: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: hrTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    backgroundColor: hrTheme.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hrTheme.border,
    backgroundColor: hrTheme.surfaceElevated,
    padding: 14,
    gap: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: hrTheme.navyTitle,
  },
  infoMeta: {
    fontSize: 13,
    color: hrTheme.navyMuted,
  },
  infoWarn: {
    fontSize: 14,
    color: hrTheme.danger,
  },
  placeholder: {
    fontSize: 14,
    color: hrTheme.textSoft,
  },
  blockHint: {
    fontSize: 12,
    color: hrTheme.textMuted,
    marginBottom: 4,
  },
  angleHint: {
    fontSize: 13,
    fontWeight: '700',
    color: hrTheme.navyTitle,
    backgroundColor: hrTheme.surface,
    borderWidth: 1,
    borderColor: hrTheme.borderLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: hrTheme.borderSoft },
  thumbIdx: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(17,40,68,0.85)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  refreshMini: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: hrTheme.surface,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  refreshMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: hrTheme.navyMuted,
  },
  meta: {
    color: hrTheme.navyMuted,
    fontSize: 13,
  },
  button: {
    marginTop: 8,
    backgroundColor: hrTheme.brandOrange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryNav: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hrTheme.border,
    alignItems: 'center',
    backgroundColor: hrTheme.surface,
  },
  secondaryNavText: {
    color: hrTheme.navyMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});
