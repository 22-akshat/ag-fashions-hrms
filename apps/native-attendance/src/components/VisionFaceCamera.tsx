import { useCallback, useEffect, useRef, useState } from 'react';
import {
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

export type VisionFaceCameraProps = {
  onPhotoTaken: (uri: string) => void;
  disabled?: boolean;
};

function photoPathToDisplayUri(path: string): string {
  if (path.startsWith('file:')) return path;
  return Platform.OS === 'android' ? `file://${path}` : path;
}

/** Loads only after `NativeModules.CameraDevices` is confirmed — avoids vision-camera import crash. */
export default function VisionFaceCamera({ onPhotoTaken, disabled = false }: VisionFaceCameraProps) {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hasPermission) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) void requestPermission();
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [hasPermission, requestPermission]);

  const takePhoto = useCallback(async () => {
    if (disabled || busy || !hasPermission || !device) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });
      if (photo?.path) {
        onPhotoTaken(photoPathToDisplayUri(photo.path));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, device, disabled, hasPermission, onPhotoTaken]);

  if (!device) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.preview, styles.centerMsg]}>
          <Text style={styles.msgText}>Front camera not available on this device.</Text>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.preview, styles.centerMsg]}>
          <Text style={styles.msgText}>Camera access is required for face capture.</Text>
          <Pressable style={styles.capture} onPress={() => void requestPermission()}>
            <Text style={styles.captureText}>Allow camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!disabled}
          photo
        />
        <View style={[styles.overlay, StyleSheet.absoluteFill]} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>
        <Text style={styles.previewHint}>Front camera — align your face in the frame</Text>
      </View>
      <Pressable
        style={[styles.capture, disabled || busy ? styles.disabled : null]}
        disabled={disabled || busy}
        onPress={() => void takePhoto()}
      >
        <Text style={styles.captureText}>{busy ? 'Capturing…' : 'Capture face'}</Text>
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
  centerMsg: {
    paddingHorizontal: 16,
  },
  msgText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
