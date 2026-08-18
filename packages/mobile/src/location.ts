import * as Location from 'expo-location';
import { Linking } from 'react-native';

/**
 * Ubicacion en foreground, con accion explicita del usuario.
 *
 * Decision de compliance, no de bateria: este archivo NUNCA puede usar
 * requestBackgroundPermissionsAsync, startLocationUpdatesAsync ni
 * startGeofencingAsync. Todas existen en expo-location y ninguna hace falta.
 *
 * Pedir background location en Android abre la pantalla de Ajustes desde Android 11,
 * obliga a una revision extra de Google Play, y contradice la postura de privacidad
 * que es el argumento central del producto.
 */

/** Cuanto esperamos un fix antes de rendirnos. Ver TIMEOUT abajo. */
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
      /** Radio de incertidumbre en metros. null si el proveedor no lo informa. */
      accuracyM: number | null;
      /** Lo que el usuario concedio, que no es lo mismo que lo que pedimos. */
      precision: Precision;
      /** true si la posicion viene de un mock provider. Solo Android. */
      mocked: boolean;
      timestamp: number;
    };

/**
 * Lee la precision realmente concedida.
 *
 * Esta funcion existe porque en Android `granted` MIENTE. Verificado leyendo el
 * modulo nativo de expo-location: `status`, `granted` y `canAskAgain` se calculan
 * chequeando solo ACCESS_COARSE_LOCATION. Si el usuario elige "Aproximada",
 * `granted` devuelve true y `status` devuelve 'granted', y la app cree que tiene
 * precision cuando en realidad tiene un area de unos 3 kilometros cuadrados.
 *
 * El unico dato confiable es `android.accuracy`.
 */
export function precisionOf(
  response: Location.LocationPermissionResponse,
): Precision | null {
  const android = response.android?.accuracy;
  if (android === 'fine') return 'fine';
  if (android === 'coarse') return 'coarse';

  // iOS, para cuando exista un build de iOS. Hoy no se compila ni se prueba.
  const ios = response.ios?.accuracy;
  if (ios === 'full') return 'fine';
  if (ios === 'reduced') return 'coarse';

  return null;
}

/**
 * Pide permiso sin disparar el dialogo si ya lo tenemos.
 * Devuelve la respuesta cruda para que quien llama decida que hacer.
 */
export async function ensurePermission(): Promise<Location.LocationPermissionResponse> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return current;
  return Location.requestForegroundPermissionsAsync();
}

/**
 * Pide el upgrade de aproximada a precisa.
 *
 * En Android 12 a 16 no existe equivalente a requestTemporaryFullAccuracyAuthorization
 * de iOS. La unica via documentada es volver a pedir FINE y COARSE juntos, y el
 * sistema muestra un dialogo distinto, de upgrade. expo-location ya pide los dos
 * juntos internamente, asi que alcanza con volver a llamar la misma funcion.
 *
 * Ojo: Android considera denegacion permanente al segundo rechazo, y despues el
 * dialogo deja de aparecer. Por eso esto se ofrece, no se insiste.
 */
export async function requestPrecisionUpgrade(): Promise<Precision | null> {
  const response = await Location.requestForegroundPermissionsAsync();
  return precisionOf(response);
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

/**
 * Un solo fix, con timeout propio.
 *
 * El timeout no es paranoia. Verificado en el fuente de expo-location 57.0.11:
 * requestSingleLocation llama getCurrentLocation(request, null) pasando null como
 * CancellationToken, y no hay temporizador en ninguna capa. Si el proveedor nunca
 * devuelve un fix, la promesa no resuelve ni rechaza (issue expo/expo#39851).
 * LocationOptions tampoco expone una opcion `timeout`.
 *
 * En una demo en vivo, una promesa que nunca resuelve es una pantalla congelada.
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
 * El flujo completo, en el orden que Android exige.
 *
 * Se llama SOLO desde el handler del tap, nunca al montar la pantalla. El tap es lo
 * que justifica pedir la ubicacion, y es tambien lo que la hace defendible frente a
 * la regulacion de Estados Unidos.
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
