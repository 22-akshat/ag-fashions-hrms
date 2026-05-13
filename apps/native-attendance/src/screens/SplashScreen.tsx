import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { hrTheme } from '../theme/hrTheme';

export default function SplashScreen() {
  const { isHydrated, employeeId, registeredFaceUri, setStage } = useApp();

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>HR</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>AG Fashions</Text>
          <Text style={styles.brandSub}>Attendance · Management suite</Text>
        </View>
      </View>
      <Text style={styles.headline}>Welcome</Text>
      <Text style={styles.text}>
        {isHydrated && employeeId && registeredFaceUri
          ? 'Continue to mark attendance with face verification.'
          : 'Complete registration first, or sign in from the login screen.'}
      </Text>
      <Pressable
        style={styles.primary}
        onPress={() => {
          if (employeeId && registeredFaceUri) setStage('scan');
          else setStage('register');
        }}
      >
        <Text style={styles.primaryText}>Get started</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => setStage('register')}>
        <Text style={styles.secondaryText}>Employee registration</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: hrTheme.bg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
    backgroundColor: hrTheme.surface,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hrTheme.border,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: hrTheme.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  brandTitle: { fontSize: 18, fontWeight: '800', color: hrTheme.navyTitle },
  brandSub: { fontSize: 11, fontWeight: '600', color: hrTheme.textMuted, marginTop: 2 },
  headline: {
    marginTop: 8,
    color: hrTheme.navyTitle,
    fontSize: 26,
    fontWeight: '800',
  },
  text: {
    color: hrTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 8,
  },
  primary: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: hrTheme.brandOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  secondary: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: hrTheme.surface,
    borderWidth: 1,
    borderColor: hrTheme.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: hrTheme.navyMuted,
    fontWeight: '700',
    fontSize: 15,
  },
});
