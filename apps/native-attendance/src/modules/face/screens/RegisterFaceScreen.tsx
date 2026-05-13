import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardNumberForm } from '../components/CardNumberForm';
import { FaceCaptureCard } from '../components/FaceCaptureCard';
import { RegistrationSuccessCard } from '../components/RegistrationSuccessCard';
import { useFaceRegistration } from '../hooks/useFaceRegistration';
import { hasSupabaseConfig } from '../../../supabase';
import type { AppStage } from '../../../context/AppContext';

type Props = {
  onDone: () => void;
  onBack: (stage: AppStage) => void;
};

export default function RegisterFaceScreen({ onDone, onBack }: Props) {
  const reg = useFaceRegistration();

  const onBackSafe = useCallback(() => {
    reg.reset();
    onBack('register');
  }, [onBack, reg]);

  if (!hasSupabaseConfig) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Configure Supabase in .env to use face registration.</Text>
        <Pressable style={styles.linkBtn} onPress={onBackSafe}>
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={onBackSafe}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.h1}>Register face & device</Text>
      <Text style={styles.sub}>
        Secure step: links this install to your HR profile. Attendance verification will use this template in a later
        phase.
      </Text>

      {(reg.phase === 'card' || reg.phase === 'review' || reg.phase === 'error') && (
        <CardNumberForm
          value={reg.cardNo}
          onChangeText={reg.setCardNo}
          onLookup={() => void reg.lookup()}
          loading={reg.lookupLoading}
        />
      )}

      {reg.error ? <Text style={styles.err}>{reg.error}</Text> : null}

      {reg.employee && reg.phase === 'confirm_replace' ? (
        <View style={styles.info}>
          <Text style={styles.name}>{reg.employee.full_name}</Text>
          <Text style={styles.warnInline}>
            Replace existing face template? Prior embedding is overwritten server-side — HR can still see timestamps in
            face_registered_at.
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.secondary, { flex: 1 }]}
              onPress={() => {
                reg.cancelReplace();
              }}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primary, { flex: 1 }]} onPress={reg.confirmReplace}>
              <Text style={styles.primaryText}>Replace template</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {reg.employee &&
      reg.phase !== 'done' &&
      reg.phase !== 'capturing' &&
      reg.phase !== 'saving' &&
      reg.phase !== 'confirm_replace' ? (
        <View style={styles.info}>
          <Text style={styles.name}>{reg.employee.full_name}</Text>
          <Text style={styles.meta}>Card · {reg.employee.card_no}</Text>
          {reg.employee.has_registered_face ? (
            <Text style={styles.warnInline}>
              An existing template will require explicit replace confirmation on continue.
            </Text>
          ) : null}
          <Pressable style={styles.primary} onPress={reg.startCapture}>
            <Text style={styles.primaryText}>Continue to face capture</Text>
          </Pressable>
        </View>
      ) : null}

      {reg.phase === 'capturing' ? (
        <FaceCaptureCard
          onPhotoTaken={(uri) => void reg.onPhotoCapture(uri)}
          subtitle="Hold still — we will store a numeric template only."
        />
      ) : null}

      {reg.phase === 'saving' ? (
        <View style={styles.saving}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.savingText}>Saving template and binding device…</Text>
        </View>
      ) : null}

      {reg.phase === 'done' && reg.employee ? (
        <>
          <RegistrationSuccessCard
            employeeName={reg.employee.full_name}
            cardNo={reg.employee.card_no}
            deviceLabel="This device is now bound in employee_devices."
          />
          <Pressable style={styles.primary} onPress={onDone}>
            <Text style={styles.primaryText}>Done</Text>
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
    paddingVertical: 4,
  },
  backText: {
    color: '#166534',
    fontWeight: '700',
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
  centered: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  warn: {
    fontSize: 15,
    color: '#b45309',
    textAlign: 'center',
  },
  linkBtn: {
    alignSelf: 'center',
  },
  linkText: {
    color: '#166534',
    fontWeight: '700',
  },
  err: {
    color: '#b91c1c',
    fontSize: 14,
    marginTop: 4,
  },
  info: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    gap: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  meta: {
    fontSize: 14,
    color: '#166534',
  },
  warnInline: {
    fontSize: 13,
    color: '#b45309',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primary: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: {
    color: '#374151',
    fontWeight: '700',
  },
  saving: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  savingText: {
    fontSize: 14,
    color: '#166534',
  },
});
