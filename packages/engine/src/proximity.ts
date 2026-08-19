import { decide } from './converge';
import { haversineM } from './geo';
import type { Card, Merchant, MerchantCandidate, Recommendation } from './types';

/**
 * Pure trigger logic for the proximity notification.
 *
 * It lives in the engine and not in the app for one reason: it is the only part of
 * the feature that can be tested without a phone, and getting it wrong is invisible
 * until a demo goes silent or fires eight notifications in a food court. The app layer
 * on top of this is just watchPositionAsync plus scheduleNotificationAsync.
 *
 * Nothing here is background aware on purpose. See location.ts in the app: the
 * decision is that location is only read while the Activity is visible.
 */

export const PROXIMITY = {
  /** Entering this radius arms a notification. */
  enterRadiusM: 120,
  /**
   * Leaving this radius re-arms the merchant.
   *
   * Wider than enterRadiusM on purpose. With a single radius, a fix jittering by a few
   * meters around the border re-notifies forever. Hysteresis is the standard fix and
   * it costs one number.
   */
  exitRadiusM: 220,
  /**
   * Above this error the fix cannot say which block you are on, let alone which store.
   * Notifying anyway would mean pinging the user across a whole neighborhood.
   */
  maxAccuracyM: 200,
  /** No second notification within this window, however much walking happens. */
  cooldownMs: 90_000,
} as const;

export type ProximityState = {
  /** Merchant ids currently inside the exit radius, so they do not re-fire. */
  inside: string[];
  /** When the last notification was emitted, to honor the cooldown. */
  lastNotifiedAt: number | null;
};

export function emptyProximityState(): ProximityState {
  return { inside: [], lastNotifiedAt: null };
}

export type ProximityEvent =
  | {
      kind: 'converged';
      anchor: MerchantCandidate;
      /** Every merchant inside the enter radius, not only the anchor. */
      candidates: MerchantCandidate[];
      recommendation: Recommendation;
    }
  | {
      kind: 'ambiguous';
      anchor: MerchantCandidate;
      candidates: MerchantCandidate[];
      /** How many distinct answers the candidates produce. */
      answerCount: number;
    };

export type ProximityStep = {
  state: ProximityState;
  /**
   * At most one event per step, never one per merchant.
   *
   * Eight stores in a food court are eight arrivals and one decision. Sending eight
   * notifications would be the same mistake the convergence rule exists to avoid.
   */
  event: ProximityEvent | null;
};

/**
 * Advances the trigger by one position update.
 *
 * Pure: same inputs, same outputs, no clock and no side effects. `now` is passed in so
 * the cooldown is testable.
 */
export function evaluateProximity(
  state: ProximityState,
  point: { lat: number; lon: number },
  accuracyM: number,
  merchants: Merchant[],
  cards: Card[],
  now: number,
): ProximityStep {
  if (accuracyM > PROXIMITY.maxAccuracyM) {
    // A bad fix is not a reason to guess. It is a reason to stay quiet.
    return { state, event: null };
  }

  const withDistance: MerchantCandidate[] = merchants
    .map((m) => ({ ...m, distanceM: haversineM(point, m) }))
    .filter((m) => m.distanceM <= PROXIMITY.exitRadiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  const stillInside = new Set(
    withDistance.filter((m) => state.inside.includes(m.id)).map((m) => m.id),
  );

  const entering = withDistance.filter(
    (m) => m.distanceM <= PROXIMITY.enterRadiusM && !stillInside.has(m.id),
  );

  // Everything within the enter radius is marked before deciding whether to notify.
  // Marking only on notification would make a merchant skipped by the cooldown fire
  // on the very next update, which is the cooldown leaking.
  const inside = [
    ...stillInside,
    ...entering.map((m) => m.id),
  ];

  const nextState: ProximityState = { inside, lastNotifiedAt: state.lastNotifiedAt };

  const anchor = entering[0];
  if (!anchor) return { state: nextState, event: null };

  const coolingDown =
    state.lastNotifiedAt !== null && now - state.lastNotifiedAt < PROXIMITY.cooldownMs;
  if (coolingDown) return { state: nextState, event: null };

  const candidates = withDistance.filter(
    (m) => m.distanceM <= PROXIMITY.enterRadiusM,
  );

  const decision = decide(candidates, cards);
  nextState.lastNotifiedAt = now;

  if (decision.kind === 'converged') {
    return {
      state: nextState,
      event: {
        kind: 'converged',
        anchor,
        candidates,
        recommendation: decision.recommendation,
      },
    };
  }

  return {
    state: nextState,
    event: {
      kind: 'ambiguous',
      anchor,
      candidates,
      answerCount: decision.groups.length,
    },
  };
}
