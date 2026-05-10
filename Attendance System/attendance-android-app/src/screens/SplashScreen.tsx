import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { devSkipFaceMatch } from '../lib/faceEnv';

export default function SplashScreen() {
  const {
    isHydrated,
    employeeId,
    registeredFaceUri,
    registeredFaceEmbedding,
    setStage,
  } = useApp();

  useEffect(() => {
    if (!isHydrated) return;
    const readyForScan =
      Boolean(employeeId.trim() && registeredFaceUri) &&
      (devSkipFaceMatch || Boolean(registeredFaceEmbedding?.length));
    const next = readyForScan ? 'scan' : 'register';

    const timer = setTimeout(() => {
      setStage(next);
    }, 800);
    return () => clearTimeout(timer);
  }, [
    isHydrated,
    employeeId,
    registeredFaceUri,
    registeredFaceEmbedding,
    setStage,
  ]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Attendance App</Text>
      <ActivityIndicator size="large" color="#2563eb" />
      {!isHydrated ? (
        <Text style={styles.caption}>Loading saved profile…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  caption: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
