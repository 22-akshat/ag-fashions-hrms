import { lazy, Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, NativeModules, StyleSheet, View } from 'react-native';

import FallbackFaceCamera from './FallbackFaceCamera';

const VisionFaceCamera = lazy(() => import('./VisionFaceCamera'));

type Props = {
  onPhotoTaken: (uri: string) => void;
  disabled?: boolean;
};

function hasVisionCameraNativeModule(): boolean {
  try {
    return NativeModules.CameraDevices != null;
  } catch {
    return false;
  }
}

/**
 * Vision Camera runs `getConstants()` at import time. If the native module is missing
 * (old APK, failed link, or Bridgeless timing), importing `react-native-vision-camera` crashes.
 * We only dynamically import it after `NativeModules.CameraDevices` exists.
 */
export default function FaceCamera(props: Props) {
  const [route, setRoute] = useState<'check' | 'vision' | 'fallback'>('check');

  useEffect(() => {
    if (hasVisionCameraNativeModule()) {
      setRoute('vision');
      return;
    }
    let cancelled = false;
    let n = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      if (hasVisionCameraNativeModule()) {
        clearInterval(id);
        setRoute('vision');
        return;
      }
      n++;
      if (n >= 40) {
        clearInterval(id);
        setRoute('fallback');
      }
    }, 50);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (route === 'check') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }

  if (route === 'fallback') {
    return <FallbackFaceCamera {...props} />;
  }

  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color="#22c55e" />
        </View>
      }
    >
      <VisionFaceCamera {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
