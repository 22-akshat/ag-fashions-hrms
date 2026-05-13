import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import FaceCamera from '../components/FaceCamera';
import { extractRegistrationEmbedding } from '../lib/faceRecognition';
import { faceMatchThreshold } from '../lib/faceEnv';
import { compareFaceEmbeddings } from '../modules/face/lib/faceMatcher';
import { lookupEmployeeByCardNo } from '../modules/face/lib/employeeLookup';
import { hasSupabaseConfig, supabase } from '../supabase';
import { hrTheme } from '../theme/hrTheme';

type Props = {
  onOpenFaceRegistration?: () => void;
  onOpenRegister?: () => void;
};

export default function EmployeeLoginScreen({ onOpenFaceRegistration, onOpenRegister }: Props) {
  const { signInWithFaceEmployee } = useEmployeeAuth();
  const [card, setCard] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFaceVerify, setShowFaceVerify] = useState(false);

  const openFaceVerification = () => {
    if (!hasSupabaseConfig) {
      Alert.alert('Missing config', 'Configure Supabase env variables in .env.');
      return;
    }
    if (!supabase) {
      Alert.alert('Missing config', 'Supabase client not initialized.');
      return;
    }
    const trimmed = card.trim();
    if (!trimmed) {
      Alert.alert('Card required', 'Enter your employee card number first.');
      return;
    }
    setShowFaceVerify(true);
  };

  const handleVerifyPhoto = async (uri: string) => {
    const sb = supabase;
    if (!sb) {
      Alert.alert('Missing config', 'Supabase client not initialized.');
      setShowFaceVerify(false);
      return;
    }
    setBusy(true);
    try {
      const row = await lookupEmployeeByCardNo(card.trim());
      if (!row?.id) throw new Error('No active employee found for this card.');

      const { data, error } = await sb.rpc('mobile_get_registered_face_embedding', {
        p_employee_id: row.id,
        p_card_no: row.card_no,
      });
      if (error) throw new Error(error.message);
      const rawEmbedding =
        Array.isArray(data) ? data : typeof data === 'string' ? (JSON.parse(data) as unknown) : null;
      const parsed = Array.isArray(rawEmbedding)
        ? rawEmbedding.filter((n) => typeof n === 'number' && Number.isFinite(n))
        : [];
      if (!parsed.length) {
        throw new Error('No enrolled face template found. Complete registration first.');
      }

      const fresh = await extractRegistrationEmbedding(uri, { devTemplateSeed: row.id });
      if (!fresh?.length) {
        throw new Error(
          'Could not derive a face template from this photo. Use a release build with ML or set EXPO_PUBLIC_DEV_SKIP_FACE_MATCH for testing.',
        );
      }
      const result = compareFaceEmbeddings(parsed, fresh);
      if (!Number.isFinite(result.score) || result.score < faceMatchThreshold) {
        throw new Error('Face does not match the registered template. Try again.');
      }
      setShowFaceVerify(false);
      await signInWithFaceEmployee(row.id);
    } catch (e) {
      Alert.alert('Verification failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {onOpenRegister ? (
        <Pressable style={styles.registerTop} onPress={() => onOpenRegister()} disabled={busy}>
          <Text style={styles.registerTopText}>Register</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Employee login</Text>
        <Text style={styles.sub}>
          Enter your card number, then unlock with face. Your live view is compared to the template saved during
          registration only — not stored as a new enrollment.
        </Text>

        <Text style={styles.label}>Card number</Text>
        <TextInput
          value={card}
          onChangeText={setCard}
          placeholder="Employee card number"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy && !showFaceVerify}
        />

        <Pressable
          style={[styles.btn, busy || showFaceVerify ? styles.disabled : null]}
          onPress={openFaceVerification}
          disabled={busy || showFaceVerify}
        >
          <Text style={styles.btnText}>Unlock with face</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          disabled={busy}
          onPress={() => {
            if (onOpenFaceRegistration) onOpenFaceRegistration();
          }}
        >
          <Text style={styles.secondaryBtnText}>HR face & device enrollment</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Note</Text>
          <Text style={styles.noteText}>
            Face capture for onboarding is available from Register (top-right) and HR enrollment. This screen only
            verifies you against your existing template.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showFaceVerify} animationType="slide" onRequestClose={() => !busy && setShowFaceVerify(false)}>
        <View style={styles.modalRoot}>
          <Text style={styles.modalTitle}>Face verification</Text>
          <Text style={styles.modalSub}>
            Align your face with the camera. We match this frame to your registered template.
          </Text>
          <FaceCamera onPhotoTaken={(uri) => void handleVerifyPhoto(uri)} disabled={busy} />
          {busy ? (
            <View style={styles.modalBusy}>
              <ActivityIndicator color={hrTheme.brandOrange} size="large" />
              <Text style={styles.modalBusyText}>Checking…</Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.modalCancel, busy ? styles.disabled : null]}
            onPress={() => setShowFaceVerify(false)}
            disabled={busy}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hrTheme.bg },
  registerTop: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: hrTheme.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  registerTopText: { fontWeight: '800', color: hrTheme.brandOrangeDark, fontSize: 13 },
  wrap: { flexGrow: 1, padding: 20, paddingTop: 52, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 24, fontWeight: '800', color: hrTheme.navyTitle },
  sub: { fontSize: 13, color: hrTheme.textMuted, lineHeight: 18, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: hrTheme.textMuted, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    backgroundColor: hrTheme.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btn: {
    backgroundColor: hrTheme.brandOrange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: hrTheme.surface,
  },
  secondaryBtnText: {
    color: hrTheme.navyMuted,
    fontWeight: '700',
  },
  disabled: { opacity: 0.65 },
  noteCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: hrTheme.surfaceElevated,
  },
  noteTitle: { fontSize: 13, fontWeight: '800', color: hrTheme.navyTitle, marginBottom: 4 },
  noteText: { fontSize: 13, color: hrTheme.textMuted, lineHeight: 18 },
  modalRoot: {
    flex: 1,
    backgroundColor: hrTheme.bg,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: hrTheme.navyTitle },
  modalSub: { fontSize: 14, color: hrTheme.textMuted, lineHeight: 20, marginBottom: 4 },
  modalBusy: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  modalBusyText: { fontSize: 14, color: hrTheme.navyMuted, fontWeight: '600' },
  modalCancel: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: hrTheme.surface,
  },
  modalCancelText: { color: hrTheme.navyMuted, fontWeight: '800', fontSize: 15 },
});
