import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { stopTracking } from '../locationService';
import { hrTheme } from '../theme/hrTheme';

export default function SuccessScreen() {
  const { setStage, setFaceSession, lastSuccessfulPunchType, setLastSuccessfulPunchType } = useApp();
  const [busy, setBusy] = useState(false);

  const onStopTracking = async () => {
    setBusy(true);
    try {
      await stopTracking();
      Alert.alert('Stopped', 'Background location tracking is off.');
      setFaceSession(null, null);
      setLastSuccessfulPunchType(null);
      setStage('dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Attendance Marked</Text>
      <Text style={styles.punchLine}>
        {lastSuccessfulPunchType === 'out' ? 'Mark OUT recorded' : 'Mark IN recorded'}
      </Text>
      <Text style={styles.subtitle}>
        Background location keeps syncing roughly every ~5 minutes while tracking is active.
      </Text>

      <Pressable
        style={styles.primary}
        onPress={() => {
          setFaceSession(null, null);
          setLastSuccessfulPunchType(null);
          setStage('dashboard');
        }}
        disabled={busy}
      >
        <Text style={styles.primaryText}>Back to dashboard</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => {
          setFaceSession(null, null);
          setLastSuccessfulPunchType(null);
          setStage('scan');
        }}
        disabled={busy}
      >
        <Text style={styles.secondaryText}>Mark again</Text>
      </Pressable>

      <Pressable
        style={[styles.warnButton, busy ? styles.disabled : null]}
        onPress={() => void onStopTracking()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.warnText}>Stop location tracking</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: hrTheme.bg,
  },
  icon: {
    fontSize: 38,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: hrTheme.navyTitle,
  },
  punchLine: {
    fontSize: 16,
    fontWeight: '800',
    color: hrTheme.brandOrangeDark,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: hrTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    marginTop: 12,
    backgroundColor: hrTheme.brandOrange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: '80%',
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondary: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: '80%',
    alignItems: 'center',
    backgroundColor: hrTheme.surface,
  },
  secondaryText: {
    color: hrTheme.navyMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  warnButton: {
    marginTop: 12,
    backgroundColor: hrTheme.danger,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: '80%',
    alignItems: 'center',
  },
  warnText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
});
