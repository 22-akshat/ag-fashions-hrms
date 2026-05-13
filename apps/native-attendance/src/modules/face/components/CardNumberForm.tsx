import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onLookup: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function CardNumberForm({ value, onChangeText, onLookup, loading, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Card number</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Enter card number"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="default"
        style={styles.input}
        editable={!disabled && !loading}
      />
      <Pressable
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={onLookup}
        disabled={disabled || loading || !value.trim()}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Look up employee</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: '#fff', fontWeight: '800' },
});
