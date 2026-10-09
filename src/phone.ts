import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Places a phone call to `number`.
 *
 * - Android: if CALL_PHONE is granted, starts the call immediately (ACTION_CALL);
 *   otherwise falls back to opening the dialer with the number filled in.
 * - iOS: opens a `tel:` link; iOS always shows its own "Call …?" confirmation.
 */
export async function placeCall(number: string): Promise<void> {
  const uri = `tel:${number}`;

  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
        title: 'Allow phone calls',
        message: 'Rotary Phone needs permission to place the call you dial.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        // Don't await: the promise only settles when the call screen is closed.
        IntentLauncher.startActivityAsync('android.intent.action.CALL', { data: uri }).catch(() =>
          Linking.openURL(uri),
        );
        return;
      }
    } catch {
      // Fall through to the dialer.
    }
  }

  await Linking.openURL(uri);
}
