import { StyleSheet, Text, View } from 'react-native';

import FaceCamera from '../../../components/FaceCamera';

type Props = {
  onPhotoTaken: (uri: string) => void;
  disabled?: boolean;
  subtitle?: string;
};

export function FaceCaptureCard({ onPhotoTaken, disabled, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Face capture</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      <FaceCamera onPhotoTaken={(uri) => void onPhotoTaken(uri)} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sub: {
    fontSize: 13,
    color: '#166534',
  },
});
