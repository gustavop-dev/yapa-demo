import * as Location from 'expo-location';
import { Linking } from 'react-native';

/**
 * Foreground location, behind an explicit user action.
 *
 * A compliance decision, not a battery one: this file may NEVER use
 * requestBackgroundPermissionsAsync, startLocationUpdatesAsync or
 * startGeofencingAsync. All of them exist in expo-location and none of them is needed.
 *
 * Asking for background location on Android opens the Settings screen since Android
 * 11, forces an extra Google Play review, and contradicts the privacy stance that is
 * the central argument of the product.
 */

/** How long we wait for a fix before giving up. See fixWithTimeout below. */
const FIX_TIMEOUT_MS = 15_000;

export type Precision = 'fine' | 'coarse';

export type LocationOutcome =
  | { kind: 'services-off' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string }
  | {
      kind: 'fix';
      lat: number;
      lon: number;
      /** Uncertainty radius in meters. null if the provider does not report it. */
      accuracyM: number | null;
      /** What the user granted, which is not the same as what we asked for. */
      precision: Precision;
      /** true if the position comes from a mock provider. Android only. */
      mocked: boolean;
      timestamp: number;
    };

/**
 * Reads the precision actually granted.
 *
 * This function exists because on Android `granted` LIES. Verified by reading the
 * native expo-location module: `status`, `granted` and `canAskAgain` are computed by
 * checking ACCESS_COARSE_LOCATION only. If the user picks "Approximate", `granted`
 * returns true and `status` returns 'granted', and the app believes it has precision
 * when what it really has is an area of about 3 square kilometers.
 *
 * The only trustworthy field is `android.accuracy`.
 */
export function precisionOf(
  response: Location.LocationPermissionResponse,
): Precision | null {
  const android = response.android?.accuracy;
  if (android === 'fine') return 'fine';
  if (android === 'coarse') return 'coarse';

  // iOS, for when an iOS build exists. Today it is neither compiled nor tested.
  const ios = response.ios?.accuracy;
  if (ios === 'full') return 'fine';
  if (ios === 'reduced') return 'coarse';

  return null;
}

/**
 * Asks for permission without firing the dialog when we already have it.
 * Returns the raw response so the caller decides what to do.
 */
export async function ensurePermission(): Promise<Location.LocationPermissionResponse> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return current;
  return Location.requestForegroundPermissionsAsync();
}

/**
 * Asks for the upgrade from approximate to precise.
 *
 * On Android 12 to 16 there is no equivalent to iOS
 * requestTemporaryFullAccuracyAuthorization. The only documented path is to request
 * FINE and COARSE together again, and the system shows a different, upgrade oriented
 * dialog. expo-location already asks for both together internally, so calling the same
 * function again is enough.
 *
 * Careful: Android treats the second refusal as a permanent denial, and after that the
 * dialog stops appearing. That is why this is offered, not insisted on.
 */
export async function requestPrecisionUpgrade(): Promise<Precision | null> {
  const response = await Location.requestForegroundPermissionsAsync();
  return precisionOf(response);
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

/**
 * A single fix, with a timeout of our own.
 *
 * The timeout is not paranoia. Verified in the expo-location 57.0.11 source:
 * requestSingleLocation calls getCurrentLocation(request, null) passing null as the
 * CancellationToken, and there is no timer at any layer. If the provider never returns
 * a fix, the promise neither resolves nor rejects (issue expo/expo#39851).
 * LocationOptions does not expose a `timeout` option either.
 *
 * In a live demo, a promise that never resolves is a frozen screen.
 */
async function fixWithTimeout(): Promise<Location.LocationObject> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), FIX_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The full flow, in the order Android requires.
 *
 * Called ONLY from the tap handler, never on screen mount. The tap is what justifies
 * asking for location, and it is also what makes it defensible under US regulation.
 */
export async function requestFix(): Promise<LocationOutcome> {
  try {
    const permission = await ensurePermission();

    if (!permission.granted) {
      return { kind: 'denied', canAskAgain: permission.canAskAgain };
    }

    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) return { kind: 'services-off' };

    const precision = precisionOf(permission) ?? 'coarse';
    const position = await fixWithTimeout();

    return {
      kind: 'fix',
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      precision,
      mocked: position.mocked === true,
      timestamp: position.timestamp,
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'LOCATION_TIMEOUT') {
      return { kind: 'timeout' };
    }
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
