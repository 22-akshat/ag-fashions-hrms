import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import FaceCamera from '../components/FaceCamera';
import { useApp } from '../context/AppContext';
import { markAttendance } from '../lib/attendanceApi';
import { devSkipFaceMatch, runsInExpoGo } from '../lib/faceEnv';
import { verifyScanAgainstEmbedding } from '../lib/faceRecognition';
import { verifyGeofence } from '../lib/locationChecker';
import { resolveActiveGeofence } from '../lib/shopGeofence';
import { startTracking } from '../locationService';

export default function ScanScreen() {
  const {
    employeeId,
    registeredFaceUri,
    registeredFaceEmbedding,
    shopFence,
    shopFenceLoading,
    shopFenceError,
    refreshShopFence,
    setStage,
  } = useApp();
  const [busy, setBusy] = useState(false);

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

      let faceVerified = false;

      if (devSkipFaceMatch) {
        faceVerified = false;
      } else {
        if (!registeredFaceEmbedding?.length) {
          Alert.alert(
            'Missing face embedding',
            'Register again with a proper build, or enable dev skip in .env for testing.',
          );
          setStage('register');
          return;
        }
        await verifyScanAgainstEmbedding(registeredFaceEmbedding, currentFaceUri);
        faceVerified = true;
      }

      await markAttendance({
        employeeId,
        faceVerified,
      });

      await startTracking(employeeId);
      setStage('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attendance failed';
      Alert.alert('Error', message);
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
      <Text style={styles.subtitle}>Employee (card no. / UUID): {employeeId || 'Not set'}</Text>
      {shopFenceLoading ? (
        <View style={styles.storeRow}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.storeMeta}> Loading store GPS from Supabase…</Text>
        </View>
      ) : (
        <Text style={styles.storeMeta}>{geofenceStatusLine}</Text>
      )}
      {runsInExpoGo && !devSkipFaceMatch ? (
        <Text style={styles.notice}>
          Expo Go cannot load ExpoFaceDetection. Use .env DEV_SKIP_FACE_MATCH=true or expo run:android.
        </Text>
      ) : null}
      {devSkipFaceMatch ? (
        <Text style={styles.notice}>
          Dev skip: attendance logs with face_verified = false until you use a native dev build with
          face matching.
        </Text>
      ) : null}
      <FaceCamera
        onPhotoTaken={(uri) => void handleScan(uri)}
        disabled={busy || shopFenceLoading}
      />
      <Pressable
        style={[styles.altButton, busy ? styles.disabled : null]}
        onPress={() => setStage('register')}
        disabled={busy}
      >
        <Text style={styles.altButtonText}>Go to Register</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeMeta: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  notice: {
    color: '#b45309',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
  },
  altButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  altButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.65,
  },
});
