import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { devSkipFaceMatch, runsInExpoGo } from '../lib/faceEnv';
import { extractRegistrationEmbedding } from '../lib/faceRecognition';
import { fetchNearestShopForGps, type NearestShopMatch } from '../lib/shopGeofence';
import { hasSupabaseConfig } from '../supabase';

type LocPhase = 'idle' | 'loading' | 'done';

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

  const [capturedFaceUri, setCapturedFaceUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedCard = cardInput.trim();
  const canUseFaceCapture =
    Boolean(resolvedEmployee) &&
    locPhase === 'done' &&
    nearestShopLabel !== null &&
    !locDenied &&
    !locLoadError;

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
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocDenied(true);
        setNearestShopLabel(null);
        setNearestShopMatch(null);
        setGpsSnapshot(null);
        setLocPhase('done');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGpsSnapshot({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy:
          pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null,
      });

      const match = await fetchNearestShopForGps(
        pos.coords.latitude,
        pos.coords.longitude,
      );

      if (!match) {
        setNearestShopMatch(null);
        setNearestShopLabel('डेटाबेस में कोई शॉप मिल नहीं रहा.');
        setLocPhase('done');
        return;
      }

      setNearestShopMatch(match);
      const name = match.shop.name?.trim() || 'Store';
      if (match.insideRadius) {
        setNearestShopLabel(`${name} • आप स्टोर की सीमा (रेडियस) में हैं`);
      } else {
        const m = Math.round(match.distanceMeters);
        setNearestShopLabel(`${name} • लगभग ${m} m दूर`);
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
    void loadGpsAndShopLabel();
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
          setEmployeeError(row ? null : 'यह कार्ड नं. Employees में नहीं मिला।');
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
    setCapturedFaceUri(null);
  }, [trimmedCard, resolvedEmployee?.id]);

  const handleSave = async () => {
    if (!trimmedCard) {
      Alert.alert('कार्ड नं.', 'पहले कार्ड नं. दर्ज करें।');
      return;
    }
    if (!resolvedEmployee) {
      Alert.alert('कर्मचारी नहीं मिला', 'सही कार्ड नं. डालें — नाम डेटाबेस से आना चाहिए।');
      return;
    }
    if (!canUseFaceCapture) {
      if (locDenied) {
        Alert.alert('स्थान की अनुमति', 'सेटिंग से लोकेशन ऑन करें ताकि DB से शॉप का नाम दिखे।');
      } else if (locPhase !== 'done' || nearestShopLabel === null || locLoadError) {
        Alert.alert('स्थान चेक हो रहा है', 'GPS और शॉप लोड होने का इंतजार करें।');
      }
      return;
    }
    if (!capturedFaceUri) {
      Alert.alert('चेहरा', 'पहले चेहरा कैप्चर करें।');
      return;
    }

    setBusy(true);
    try {
      const embedding = await extractRegistrationEmbedding(capturedFaceUri);
      if (!devSkipFaceMatch && (!embedding || embedding.length === 0)) {
        Alert.alert(
          'Face model unavailable',
          'Build a custom dev client (see README) or set EXPO_PUBLIC_DEV_SKIP_FACE_MATCH=true for testing only.',
        );
        return;
      }

      if (!gpsSnapshot) {
        Alert.alert(
          'स्थान',
          'GPS डेटा उपलब्ध नहीं — Refresh GPS करें और फिर कोशिश करें।',
        );
        return;
      }

      try {
        const deviceId = await getOrCreateDeviceInstallId();
        await submitRegistrationAccessRequest({
          employeeUuid: resolvedEmployee.id,
          requesterName: resolvedEmployee.full_name,
          cardNo: resolvedEmployee.card_no || trimmedCard,
          requestedShopId: nearestShopMatch?.shop.id ?? null,
          lat: gpsSnapshot.lat,
          lng: gpsSnapshot.lng,
          accuracyM: gpsSnapshot.accuracy,
          deviceId,
        });
      } catch (accessErr) {
        const msg = accessErr instanceof Error ? accessErr.message : String(accessErr);
        Alert.alert(
          'Access request failed',
          `${msg}\n\nHR डैशबोर्ड पर अनुरोध बिना इसके नहीं दिखेगा। नेटवर्क चेक करके फिर कोशिश करें।`,
        );
        return;
      }

      await setEmployeeId(trimmedCard);
      await setRegisteredFaceUri(capturedFaceUri);
      await setRegisteredFaceEmbedding(embedding);
      setStage('scan');
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
      ? 'पहले GPS पर शॉप का नाम दिखना चाहिए (लोकेशन ऑन रखें)।'
      : !resolvedEmployee
        ? trimmedCard.length > 0
          ? employeeLoading
            ? 'कार्ड चेक हो रहा है…'
            : 'वैध कार्ड नं. डालकर नाम देखें।'
          : null
        : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>पंजीकरण / Register</Text>
      <Text style={styles.stepHint}>१) कार्ड नं. → नाम ⋅ २) GPS → शॉप ⋅ ३) फेस</Text>

      {runsInExpoGo && !devSkipFaceMatch ? (
        <Text style={styles.notice}>
          Expo Go cannot load ExpoFaceDetection. Add EXPO_PUBLIC_DEV_SKIP_FACE_MATCH=true in .env, or{' '}
          npx expo prebuild && npx expo run:android
        </Text>
      ) : null}
      {devSkipFaceMatch ? (
        <Text style={styles.notice}>
          Dev mode: face embedding skipped. Attendance पर face_verified = false।

        </Text>
      ) : !runsInExpoGo ? (
        <Text style={styles.hint}>फेस: MobileFaceNet (custom Android dev build)</Text>
      ) : null}

      <Text style={styles.fieldLabel}>कार्ड नं. / Card no.</Text>
      <TextInput
        placeholder="जैसा Employees में है"
        style={styles.input}
        value={cardInput}
        onChangeText={setCardInput}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>नाम / Name</Text>
      <View style={styles.infoCard}>
        {employeeLoading ? (
          <ActivityIndicator />
        ) : resolvedEmployee ? (
          <Text style={styles.infoValue}>{resolvedEmployee.full_name}</Text>
        ) : trimmedCard.length > 0 ? (
          <Text style={styles.infoWarn}>{employeeError ?? '—'}</Text>
        ) : (
          <Text style={styles.placeholder}>कार्ड डालने पर यहाँ नाम आएगा</Text>
        )}
      </View>

      <Text style={styles.fieldLabel}>स्थान / Store (GPS + डेटाबेस)</Text>
      <View style={styles.infoCard}>
        {locPhase === 'loading' ? (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.infoMeta}>GPS ले रहे हैं और शॉप मैच कर रहे हैं…</Text>
          </View>
        ) : locDenied ? (
          <Text style={styles.infoWarn}>लोकेशन परमिशन नहीं — सेटिंग से ON करें</Text>
        ) : locLoadError ? (
          <Text style={styles.infoWarn}>{locLoadError}</Text>
        ) : nearestShopLabel ? (
          <Text style={styles.infoValue}>{nearestShopLabel}</Text>
        ) : (
          <Text style={styles.placeholder}>अज्ञात</Text>
        )}
        <Pressable
          style={styles.refreshMini}
          onPress={() => void loadGpsAndShopLabel()}
          disabled={busy || locPhase === 'loading'}
        >
          <Text style={styles.refreshMiniText}>Refresh GPS</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>फेस / Face</Text>
      {faceBlockedReason ? (
        <Text style={styles.blockHint}>{faceBlockedReason}</Text>
      ) : null}
      <FaceCamera onPhotoTaken={setCapturedFaceUri} disabled={busy || !canUseFaceCapture} />
      <Text style={styles.meta}>
        {canUseFaceCapture
          ? capturedFaceUri
            ? 'फेस सेव हो गया — नीचे खत्म करें।'
            : 'कैप्चर पर टैप करें।'
          : 'फेस तब खुलेगा जब ऊपर के दोनों सेक्शन OK हों।'}
      </Text>

      <Pressable
        style={[styles.button, busy || !canUseFaceCapture ? styles.disabled : null]}
        onPress={() => void handleSave()}
        disabled={busy || !canUseFaceCapture}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>सेव करके आगे / Save & Continue</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f7f9fc' },
  wrap: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepHint: {
    fontSize: 13,
    color: '#64748b',
  },
  hint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    color: '#b45309',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
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
    fontWeight: '600',
    color: '#0f172a',
  },
  infoMeta: {
    fontSize: 13,
    color: '#475569',
  },
  infoWarn: {
    fontSize: 14,
    color: '#b91c1c',
  },
  placeholder: {
    fontSize: 14,
    color: '#94a3b8',
  },
  blockHint: {
    fontSize: 12,
    color: '#78716c',
    marginBottom: 4,
  },
  refreshMini: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  refreshMiniText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
