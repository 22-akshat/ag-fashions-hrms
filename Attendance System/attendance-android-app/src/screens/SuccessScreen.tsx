import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { stopTracking } from '../locationService';

export default function SuccessScreen() {
  const { setStage } = useApp();
  const [busy, setBusy] = useState(false);

  const onStopTracking = async () => {
    setBusy(true);
    try {
      await stopTracking();
      Alert.alert('Stopped', 'Background location tracking is off.');
      setStage('scan');
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
      <Text style={styles.subtitle}>
        Background location keeps syncing roughly every ~5 minutes while tracking is active.
      </Text>
      <Pressable style={styles.secondary} onPress={() => setStage('scan')} disabled={busy}>
        <Text style={styles.secondaryText}>Mark Again</Text>
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
  },
  icon: {
    fontSize: 38,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  secondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryText: {
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
  },
  warnButton: {
    marginTop: 12,
    backgroundColor: '#b91c1c',
    borderRadius: 10,
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
