import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import {
  PROXIMITY,
  emptyProximityState,
  evaluateProximity,
} from '../src/proximity';
import type { Merchant } from '../src/types';
import { FOOD_COURT, ORIGIN, SUPERMARKET, TARGET } from './fixtures';

/** Moves north from a point by a given number of meters. */
function north(point: { lat: number; lon: number }, meters: number) {
  return { lat: point.lat + meters / 111_320, lon: point.lon };
}

const ONE_STORE: Merchant[] = [SUPERMARKET];

describe('the proximity trigger fires once per arrival', () => {
  it('notifies when the user enters the radius', () => {
    const step = evaluateProximity(
      emptyProximityState(),
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      1_000,
    );

    expect(step.event).not.toBeNull();
    expect(step.event?.anchor.id).toBe(SUPERMARKET.id);
    expect(step.state.inside).toContain(SUPERMARKET.id);
  });

  it('stays quiet while the user keeps standing there', () => {
    const first = evaluateProximity(
      emptyProximityState(),
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      1_000,
    );

    // Far past the cooldown, so silence here is the arrival state and not the timer.
    const second = evaluateProximity(
      first.state,
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      1_000 + PROXIMITY.cooldownMs * 10,
    );

    expect(second.event).toBeNull();
  });

  it('re-arms only after leaving the exit radius, not the enter radius', () => {
    const arrived = evaluateProximity(
      emptyProximityState(),
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      1_000,
    );

    // Between both radii: out of the enter radius, still inside the exit radius.
    const between = (PROXIMITY.enterRadiusM + PROXIMITY.exitRadiusM) / 2;
    const drifting = evaluateProximity(
      arrived.state,
      north(SUPERMARKET, between),
      20,
      ONE_STORE,
      CARDS,
      1_000 + PROXIMITY.cooldownMs * 10,
    );

    expect(drifting.state.inside).toContain(SUPERMARKET.id);

    const away = evaluateProximity(
      drifting.state,
      north(SUPERMARKET, PROXIMITY.exitRadiusM + 50),
      20,
      ONE_STORE,
      CARDS,
      2_000 + PROXIMITY.cooldownMs * 10,
    );

    expect(away.state.inside).not.toContain(SUPERMARKET.id);
    expect(away.event).toBeNull();

    const returned = evaluateProximity(
      away.state,
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      3_000 + PROXIMITY.cooldownMs * 10,
    );

    expect(returned.event).not.toBeNull();
  });
});

describe('the trigger refuses to guess and refuses to spam', () => {
  it('says nothing when the fix is too coarse to place a block', () => {
    const step = evaluateProximity(
      emptyProximityState(),
      SUPERMARKET,
      PROXIMITY.maxAccuracyM + 1,
      ONE_STORE,
      CARDS,
      1_000,
    );

    expect(step.event).toBeNull();
    expect(step.state.inside).toEqual([]);
  });

  it('sends one notification for a whole food court, not eight', () => {
    const step = evaluateProximity(
      emptyProximityState(),
      ORIGIN,
      20,
      FOOD_COURT,
      CARDS,
      1_000,
    );

    expect(step.event).not.toBeNull();
    expect(step.event?.kind).toBe('converged');
    expect(step.event?.candidates.length).toBe(FOOD_COURT.length);
    expect(step.state.inside).toHaveLength(FOOD_COURT.length);
  });

  it('holds the cooldown when a second merchant appears right after', () => {
    const first = evaluateProximity(
      emptyProximityState(),
      ORIGIN,
      20,
      [SUPERMARKET],
      CARDS,
      1_000,
    );
    expect(first.event).not.toBeNull();

    const second = evaluateProximity(
      first.state,
      ORIGIN,
      20,
      [SUPERMARKET, TARGET],
      CARDS,
      1_000 + PROXIMITY.cooldownMs - 1,
    );

    expect(second.event).toBeNull();
    // Marked anyway: a merchant skipped by the cooldown must not fire on the next
    // update as if it had just been reached.
    expect(second.state.inside).toContain(TARGET.id);
  });

  it('reports how many answers are in play when candidates disagree', () => {
    const step = evaluateProximity(
      emptyProximityState(),
      ORIGIN,
      20,
      [...FOOD_COURT, TARGET],
      CARDS,
      1_000,
    );

    expect(step.event?.kind).toBe('ambiguous');
    if (step.event?.kind !== 'ambiguous') return;
    expect(step.event.answerCount).toBe(2);
  });

  it('carries the why in the notification, not just the card name', () => {
    const step = evaluateProximity(
      emptyProximityState(),
      SUPERMARKET,
      20,
      ONE_STORE,
      CARDS,
      1_000,
    );

    if (step.event?.kind !== 'converged') throw new Error('expected convergence');
    expect(step.event.recommendation.winner.cardId).toBe('amex-bcp');
    expect(step.event.recommendation.mcc.code).toBe('5411');
  });
});
