import {
  emptyProximityState,
  evaluateProximity,
  haversineM,
  PROXIMITY,
  resolveNearby,
  type Card,
  type Merchant,
  type MerchantCandidate,
  type ProximityEvent,
  type ProximityState,
  type Venue,
} from '@yapa/engine';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import { notifyNow } from './notifications';

/**
 * Proximity watcher, foreground only.
 *
 * The trigger logic lives in @yapa/engine and is unit tested there. This file is the
 * plumbing: subscribe to position updates, hand each one to the engine, and turn an
 * event into a notification.
 *
 * The watcher stops itself whenever the app leaves the foreground. That is not battery
 * hygiene, it is the same compliance decision as location.ts: without
 * ACCESS_BACKGROUND_LOCATION Android throttles updates to a few per hour anyway, so a
 * watcher that keeps running while backgrounded would only pretend to work. Stopping
 * it makes the boundary explicit.
 *
 * The notification copy stays in Spanish: it is what the founder reads on screen.
 */

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  // Both are hints, not guarantees: Android delivers when the provider has something.
  // 20 m is short enough to catch an arrival on foot without waking on every jitter.
  distanceInterval: 20,
  timeInterval: 4_000,
};

export type ProximityWatcher = {
  stop: () => void;
};

export type ProximitySnapshot =
  | {
      kind: 'ok';
      accuracyM: number;
      candidates: MerchantCandidate[];
      venue?: { id: string; name: string };
    }
  | {
      kind: 'accuracy-too-low';
      accuracyM: number;
      thresholdM: number;
    };

export type WatchStart =
  | { kind: 'watching'; watcher: ProximityWatcher }
  | { kind: 'no-permission' }
  | { kind: 'error'; message: string };

export function notificationFor(event: ProximityEvent, venueName?: string): {
  title: string;
  body: string;
} {
  if (event.kind === 'converged') {
    const rec = event.recommendation;
    return {
      title: venueName
        ? `Estas en ${venueName}`
        : `Estas llegando a ${event.anchor.name}`,
      body:
        `Paga con ${rec.winner.cardName}: ${rec.winner.rule.label}, ` +
        `${(rec.winner.valuePerDollar * 100).toFixed(2)}% por dolar. ` +
        `MCC ${rec.mcc.code}, ${rec.mcc.title}.`,
    };
  }

  return {
    title: venueName
      ? `${event.candidates.length} comercios posibles en ${venueName}`
      : `${event.candidates.length} comercios cerca de vos`,
    body:
      `Hay ${event.answerCount} respuestas posibles segun en cual estes. ` +
      `Abri Yapa y te lo desempato con una sola pregunta.`,
  };
}

/**
 * Starts watching. The caller is responsible for having asked permission first, which
 * in practice means the user already tapped the button once.
 */
export async function startProximityWatch(opts: {
  merchants: Merchant[];
  venues?: Venue[];
  cards: Card[];
  onPosition?: (snapshot: ProximitySnapshot) => void;
  onEvent?: (
    event: ProximityEvent,
    context: { venue?: { id: string; name: string } },
  ) => void;
}): Promise<WatchStart> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return { kind: 'no-permission' };

  let state: ProximityState = emptyProximityState();
  let subscription: Location.LocationSubscription | null = null;
  let stopped = false;

  const handle = async (position: Location.LocationObject): Promise<void> => {
    const point = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
    const accuracyM = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
    const venueResult = resolveNearby(
      point,
      accuracyM,
      [],
      opts.venues ?? [],
    );
    const activeVenue =
      venueResult.status === 'ok' ? venueResult.venue : undefined;
    const evaluationMerchants = activeVenue
      ? venueResult.status === 'ok'
        ? venueResult.candidates
        : []
      : opts.merchants;

    if (accuracyM > PROXIMITY.maxAccuracyM) {
      opts.onPosition?.({
        kind: 'accuracy-too-low',
        accuracyM,
        thresholdM: PROXIMITY.maxAccuracyM,
      });
    } else {
      const candidates = activeVenue
        ? venueResult.status === 'ok'
          ? venueResult.candidates
          : []
        : opts.merchants
            .map((merchant) => ({
              ...merchant,
              distanceM: haversineM(point, merchant),
            }))
            .filter((merchant) => merchant.distanceM <= PROXIMITY.enterRadiusM)
            .sort((a, b) => a.distanceM - b.distanceM);

      opts.onPosition?.({
        kind: 'ok',
        accuracyM,
        candidates,
        venue: activeVenue,
      });
    }

    const step = evaluateProximity(
      state,
      point,
      accuracyM,
      evaluationMerchants,
      opts.cards,
      position.timestamp,
    );

    state = step.state;
    if (!step.event) return;

    const { title, body } = notificationFor(step.event, activeVenue?.name);
    await notifyNow(title, body);
    opts.onEvent?.(step.event, { venue: activeVenue });
  };

  const subscribe = async (): Promise<void> => {
    if (stopped || subscription) return;
    subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (position) => {
      void handle(position);
    });
  };

  const unsubscribe = (): void => {
    subscription?.remove();
    subscription = null;
  };

  const onAppState = (next: AppStateStatus): void => {
    if (next === 'active') {
      void subscribe();
    } else {
      unsubscribe();
    }
  };

  try {
    await subscribe();
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const appStateSub = AppState.addEventListener('change', onAppState);

  return {
    kind: 'watching',
    watcher: {
      stop: () => {
        stopped = true;
        unsubscribe();
        appStateSub.remove();
      },
    },
  };
}

/**
 * Rehearsal path: runs the same engine step against a fixed point.
 *
 * It exists because the strongest proximity spot in the seed is a corner in Duitama,
 * and a live call is not the moment to find out there is nothing to walk into. It
 * runs the real trigger with a real position, it just does not wait for GPS to
 * produce it, and the screen says so out loud.
 */
export async function simulateArrival(opts: {
  point: { lat: number; lon: number };
  merchants: Merchant[];
  cards: Card[];
}): Promise<ProximityEvent | null> {
  const step = evaluateProximity(
    emptyProximityState(),
    opts.point,
    25,
    opts.merchants,
    opts.cards,
    Date.now(),
  );

  if (!step.event) return null;

  const { title, body } = notificationFor(step.event);
  await notifyNow(title, body);
  return step.event;
}
