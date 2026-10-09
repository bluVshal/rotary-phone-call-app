import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import RotaryDial from './src/components/RotaryDial';
import { placeCall } from './src/phone';

const MAX_DIGITS = 15;

export default function App() {
  return (
    <SafeAreaProvider>
      <PhoneScreen />
    </SafeAreaProvider>
  );
}

function PhoneScreen() {
  const { width, height } = useWindowDimensions();
  const [number, setNumber] = useState('');
  const dialSize = Math.min(width - 32, height * 0.55, 420);

  const addDigit = useCallback(
    (digit: string) => setNumber((n) => (n.length < MAX_DIGITS ? n + digit : n)),
    [],
  );

  const call = useCallback(async () => {
    if (!number) return;
    try {
      await placeCall(number);
    } catch {
      Alert.alert('Unable to call', 'This device cannot place phone calls.');
    }
  }, [number]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <Text style={styles.title}>ROTARY PHONE</Text>

      <View style={styles.display}>
        <Text
          style={[styles.number, !number && styles.placeholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {number || 'Dial a number'}
        </Text>
        <Pressable
          onPress={() => setNumber((n) => n.slice(0, -1))}
          onLongPress={() => setNumber('')}
          disabled={!number}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Delete last digit. Long press to clear."
          style={({ pressed }) => [styles.backspace, { opacity: !number ? 0.25 : pressed ? 0.5 : 1 }]}
        >
          <Text style={styles.backspaceText}>⌫</Text>
        </Pressable>
      </View>

      <View style={styles.dialWrap}>
        <RotaryDial size={dialSize} onDigit={addDigit} onOk={call} okEnabled={number.length > 0} />
      </View>

      <Text style={styles.hint}>
        Put your finger in a hole, turn it clockwise to the metal stop and let go.{'\n'}
        Press OK to call.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#7a1f1f',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    marginTop: 16,
    color: '#f4ecd8',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 6,
  },
  display: {
    marginTop: 20,
    height: 72,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4ecd8',
    borderRadius: 12,
    paddingHorizontal: 20,
    borderWidth: 3,
    borderColor: '#c9b98f',
  },
  number: {
    flex: 1,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#1d1d1d',
    fontVariant: ['tabular-nums'],
  },
  placeholder: { fontSize: 20, fontWeight: '500', letterSpacing: 1, color: '#9a8c6c' },
  backspace: { paddingLeft: 12 },
  backspaceText: { fontSize: 28, color: '#5b4a2e' },
  dialWrap: { flex: 1, justifyContent: 'center' },
  hint: {
    marginBottom: 16,
    color: '#e8d3c0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
