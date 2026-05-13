import { StyleSheet, Text, View } from 'react-native';

type Props = {
  employeeName: string;
  cardNo: string;
  deviceLabel?: string;
};

export function RegistrationSuccessCard({ employeeName, cardNo, deviceLabel }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Registration complete</Text>
      <Text style={styles.line}>
        {employeeName}
        {' · '}
        Card {cardNo}
      </Text>
      {deviceLabel ? <Text style={styles.muted}>{deviceLabel}</Text> : null}
      <Text style={styles.muted}>
        You can verify your face anytime from Verify face before attendance goes live against this template.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
  },
  line: {
    fontSize: 15,
    fontWeight: '700',
    color: '#064e3b',
  },
  muted: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
});
