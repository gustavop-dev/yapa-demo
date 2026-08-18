import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notificaciones, locales y remotas.
 *
 * Las tres trampas de Android estan resueltas aca, y las tres fallan EN SILENCIO si
 * se hacen mal, sin lanzar ningun error:
 *
 * 1. El canal va antes que pedir permiso y antes que pedir el token. Doc de Expo:
 *    "This prompt will not appear until at least one notification channel is created"
 *    y "setNotificationChannelAsync must be called before getExpoPushTokenAsync".
 *
 * 2. La importancia del canal no se puede cambiar despues. Doc de Android: "Once you
 *    submit the channel to the NotificationManager, you can't change the importance
 *    level". Si se crea con importancia baja, subirla en el codigo no hace nada hasta
 *    desinstalar la app o usar otro channelId.
 *
 * 3. shouldPlaySound tiene que ser true para que se vea en foreground. Doc de Expo:
 *    "On Android, setting shouldPlaySound: false will result in the drop-down
 *    notification alert not showing, no matter what the priority is".
 */

export const CHANNEL_ID = 'yapa-default';

/**
 * Sin esto, con la app abierta Android no muestra nada y parece que la notificacion
 * no llego. En una demo en vivo eso es indistinguible de un bug.
 *
 * shouldShowAlert quedo deprecado, ahora son shouldShowBanner y shouldShowList.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationSetup =
  | { kind: 'ready'; canAskAgain: boolean }
  | { kind: 'denied'; canAskAgain: boolean };

/** El canal primero, siempre. Ver trampa 1. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recomendaciones de Yapa',
    // MAX para que salga como heads-up. No se puede subir despues. Ver trampa 2.
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function setupNotifications(): Promise<NotificationSetup> {
  await ensureChannel();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return { kind: 'ready', canAskAgain: existing.canAskAgain };
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted
    ? { kind: 'ready', canAskAgain: requested.canAskAgain }
    : { kind: 'denied', canAskAgain: requested.canAskAgain };
}

/** Notificacion local inmediata. `trigger: null` significa ya. */
export async function notifyNow(title: string, body: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/**
 * Notificacion local con retraso, para poder cerrar la app y mostrar que llega igual.
 */
export async function notifyInSeconds(
  title: string,
  body: string,
  seconds: number,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export type PushTokenResult =
  | { kind: 'token'; token: string }
  | { kind: 'no-project-id' }
  | { kind: 'error'; message: string };

/**
 * Token de push remota.
 *
 * Requiere, y no hay atajo: proyecto de Firebase, google-services.json en el binario,
 * y una service account key de FCM V1 subida a EAS. El Expo Push Service abstrae el
 * envio, no las credenciales. OneSignal tampoco lo evita: toda push a Android pasa
 * por FCM, y lo unico que cambia entre proveedores es quien guarda la llave.
 *
 * El canal ya se creo arriba, que es requisito para que esto devuelva algo.
 */
export async function getPushToken(): Promise<PushTokenResult> {
  await ensureChannel();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (typeof projectId !== 'string' || projectId.startsWith('PENDIENTE')) {
    return { kind: 'no-project-id' };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return { kind: 'token', token: token.data };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
