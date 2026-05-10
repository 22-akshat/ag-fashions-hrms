import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text } from 'react-native';
import './src/locationTask';
import { AppProvider, useApp } from './src/context/AppContext';
import { applyFaceDetectionConfig } from './src/lib/faceRecognition';
import RegisterScreen from './src/screens/RegisterScreen';
import ScanScreen from './src/screens/ScanScreen';
import SplashScreen from './src/screens/SplashScreen';
import SuccessScreen from './src/screens/SuccessScreen';

function Root() {
  const { stage, setStage } = useApp();
  const canSwitch = stage === 'scan' || stage === 'register';
  const switchLabel = stage === 'scan' ? 'Register' : 'Mark Attendance';
  const nextStage = stage === 'scan' ? 'register' : 'scan';

  return (
    <SafeAreaView style={styles.safeArea}>
      {canSwitch ? (
        <Pressable style={styles.switchButton} onPress={() => setStage(nextStage)}>
          <Text style={styles.switchText}>{switchLabel}</Text>
        </Pressable>
      ) : null}
      {stage === 'splash' && <SplashScreen />}
      {stage === 'register' && <RegisterScreen />}
      {stage === 'scan' && <ScanScreen />}
      {stage === 'success' && <SuccessScreen />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    void applyFaceDetectionConfig();
  }, []);

  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  switchButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 20,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
});
