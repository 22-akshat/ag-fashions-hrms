import { useEffect } from 'react';
import { Pressable, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import { EmployeeAuthProvider, useEmployeeAuth } from './src/context/EmployeeAuthContext';
import { applyFaceDetectionConfig } from './src/lib/faceRecognition';
import RegisterFaceScreen from './src/modules/face/screens/RegisterFaceScreen';
import VerifyFaceScreen from './src/modules/face/screens/VerifyFaceScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import EmployeeLoginScreen from './src/screens/EmployeeLoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ScanScreen from './src/screens/ScanScreen';
import SplashScreen from './src/screens/SplashScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import { hrTheme } from './src/theme/hrTheme';

function Root() {
  const { loading, isAuthenticated, signOut } = useEmployeeAuth();
  const { stage, setStage } = useApp();

  useEffect(() => {
    if (!loading && isAuthenticated && stage === 'splash') {
      setStage('dashboard');
    }
  }, [loading, isAuthenticated, stage, setStage]);

  const canSwitch = isAuthenticated && (stage === 'scan' || stage === 'register');
  const switchLabel = stage === 'scan' ? 'Register' : 'Mark Attendance';
  const nextStage = stage === 'scan' ? 'register' : 'scan';

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.switchText}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    if (stage === 'face_register') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <RegisterFaceScreen onDone={() => setStage('splash')} onBack={() => setStage('splash')} />
        </SafeAreaView>
      );
    }
    if (stage === 'register') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <RegisterScreen />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmployeeLoginScreen
          onOpenFaceRegistration={() => setStage('face_register')}
          onOpenRegister={() => setStage('register')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {canSwitch ? (
        <Pressable style={styles.switchButton} onPress={() => setStage(nextStage)}>
          <Text style={styles.switchText}>{switchLabel}</Text>
        </Pressable>
      ) : null}
      {stage !== 'dashboard' ? (
        <Pressable style={[styles.switchButton, { left: 14, right: undefined }]} onPress={() => void signOut()}>
          <Text style={styles.switchText}>Sign out</Text>
        </Pressable>
      ) : null}
      {stage === 'splash' && <SplashScreen />}
      {stage === 'dashboard' && <DashboardScreen />}
      {stage === 'register' && <RegisterScreen />}
      {stage === 'scan' && <ScanScreen />}
      {stage === 'face_register' && (
        <RegisterFaceScreen onDone={() => setStage('register')} onBack={(next) => setStage(next)} />
      )}
      {stage === 'face_verify' && <VerifyFaceScreen onBack={(next) => setStage(next)} />}
      {stage === 'success' && <SuccessScreen />}
      <StatusBar barStyle="dark-content" backgroundColor={hrTheme.bg} />
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    void applyFaceDetectionConfig();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <EmployeeAuthProvider>
          <Root />
        </EmployeeAuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: hrTheme.bg,
  },
  switchButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 20,
    backgroundColor: hrTheme.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hrTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchText: {
    color: hrTheme.navyMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
