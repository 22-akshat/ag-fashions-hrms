import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onPhotoTaken: (uri: string) => void;
  disabled?: boolean;
};

export default function FaceCamera({ onPhotoTaken, disabled = false }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionText}>Camera permission is required.</Text>
        <Pressable style={styles.actionButton} onPress={requestPermission}>
          <Text style={styles.actionText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef || busy || disabled) return;
    setBusy(true);
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.5,
      });
      if (photo?.uri) onPhotoTaken(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <CameraView
        style={styles.camera}
        facing="front"
        ref={(ref) => setCameraRef(ref)}
      />
      <Pressable
        style={[styles.captureButton, disabled ? styles.captureDisabled : null]}
        onPress={handleCapture}
        disabled={busy || disabled}
      >
        <Text style={styles.captureText}>
          {disabled ? 'Please wait…' : busy ? 'Capturing...' : 'Capture Face'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  camera: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  captureButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  captureDisabled: {
    opacity: 0.65,
  },
  captureText: {
    color: '#fff',
    fontWeight: '600',
  },
  permissionWrap: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  permissionText: {
    color: '#334155',
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#1d4ed8',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
});
