import { useCallback, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';

import { ensureCameraPermission } from '../lib/geoLocation';

type Props = {
  onPhotoTaken: (uri: string) => void;
  disabled?: boolean;
};

/** Used when Vision Camera native module is unavailable (reinstall app / native linking). */
export default function FallbackFaceCamera({ onPhotoTaken, disabled = false }: Props) {
  const [busy, setBusy] = useState(false);

  const takePhoto = useCallback(async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      const ok = await ensureCameraPermission();
      if (!ok) {
        Alert.alert(
          'Camera permission',
          'Allow camera access in Settings to capture your face.',
        );
        return;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'front',
        saveToPhotos: false,
        quality: 1,
        ...(Platform.OS === 'ios' ? { presentationStyle: 'fullScreen' as const } : {}),
      });

      if (result.didCancel) return;

      const msg =
        typeof result.errorMessage === 'string'
          ? result.errorMessage
          : result.errorCode != null
            ? `Camera error (code ${String(result.errorCode)})`
            : null;
      if (msg) {
        Alert.alert('Camera', `${msg}${Platform.OS === 'android' ? '\n\nIf this persists, reinstall the app after a clean Android build.' : ''}`);
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (uri) onPhotoTaken(uri);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, onPhotoTaken]);

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        <View style={[styles.overlay, StyleSheet.absoluteFill]}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>
        <Text style={styles.previewHint}>
          Live preview needs a successful native build with Vision Camera. Tap below to open the system front camera.
        </Text>
      </View>
      <Pressable
        style={[styles.capture, disabled || busy ? styles.disabled : null]}
        disabled={disabled || busy}
        onPress={() => void takePhoto()}
      >
        <Text style={styles.captureText}>{busy ? 'Opening camera…' : 'Capture face'}</Text>
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: busy ? '58%' : '18%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  preview: {
    position: 'relative',
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  frame: {
    width: 180,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  tl: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 },
  tr: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 },
  br: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 },
  previewHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  capture: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#22c55e',
  },
  disabled: {
    opacity: 0.55,
  },
  captureText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#86efac',
  },
});
