import { createSuccess } from '@math-whiz/contracts';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function App() {
  const { width } = useWindowDimensions();
  const baseline = createSuccess('工程基线可用', {
    application: 'mobile',
  });
  const isTabletWidth = width >= 600;

  return (
    <View style={styles.screen}>
      <View style={[styles.card, isTabletWidth && styles.tabletCard]}>
        <Text style={styles.eyebrow}>状态 {baseline.status}</Text>
        <Text style={styles.title}>数学小达人</Text>
        <Text style={styles.body}>{baseline.message}</Text>
        <Text style={styles.hint}>
          {isTabletWidth ? '平板布局已启用' : '手机布局已启用'}
        </Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f4f7fb',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#1d304e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  tabletCard: {
    maxWidth: 720,
    padding: 40,
  },
  eyebrow: {
    marginBottom: 8,
    color: '#3567b7',
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: '#172033',
    fontSize: 36,
    fontWeight: '800',
  },
  body: {
    marginTop: 12,
    color: '#34425a',
    fontSize: 18,
  },
  hint: {
    marginTop: 24,
    color: '#64748b',
    fontSize: 14,
  },
});
