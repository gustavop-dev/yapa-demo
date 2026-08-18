import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notifications, local and remote.
 *
 * The three Android traps are handled here, and all three fail SILENTLY when done
 * wrong, without throwing anything:
 *
 * 1. The channel comes before asking for permission and before asking for the token.
 *    Expo docs: "This prompt will not appear until at least one notification channel
 *    is created" and "setNotificationChannelAsync must be called before
 *    getExpoPushTokenAsync".
 *
 * 2. Channel importance cannot be changed afterwards. Android docs: "Once you submit
 *    the channel to the NotificationManager, you can't change the importance level".
 *    If it is created with low importance, raising it in code does nothing until the
 *    app is uninstalled or a different channelId is used.
 *
 * 3. shouldPlaySound has to be true for it to show in foreground. Expo docs: "On
 *    Android, setting shouldPlaySound: false will result in the drop-down notification
 *    alert not showing, no matter what the priority is".
 *
 * Notification copy stays in Spanish: it is what the founder reads on screen.
 */

export const CHANNEL_ID = 'yapa-default';

/**
 * Without this, with the app open Android shows nothing and it looks like the
 * notification never arrived. In a live demo that is indistinguishable from a bug.
 *
 * shouldShowAlert is deprecated, it is now shouldShowBanner and shouldShowList.
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

/** The channel first, always. See trap 1. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recomendaciones de Yapa',
    // MAX so it shows as heads-up. It cannot be raised later. See trap 2.
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

/** Immediate local notification. `trigger: null` means now. */
export async function notifyNow(title: string, body: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/**
 * Delayed local notification, so the app can be closed and it still arrives.
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
 * Remote push token.
 *
 * It requires, with no shortcut: a Firebase project, google-services.json in the
 * binary, and an FCM V1 service account key uploaded to EAS. The Expo Push Service
 * abstracts the sending, not the credentials. OneSignal does not avoid it either:
 * every Android push goes through FCM, and the only thing that changes between
 * providers is who holds the key.
 *
 * The channel was already created above, which is a requirement for this to return
 * anything.
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
