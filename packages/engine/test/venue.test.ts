import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { decide } from '../src/converge';
import { PRECISION, resolveNearby } from '../src/geo';
import type { Venue } from '../src/types';

/**
 * Innovo Plaza, Duitama. Centroid and radius computed over the real building
 * footprint in OpenStreetMap (way/962050370, a 44 node polygon).
 */
const INNOVO: Venue = {
  id: 'innovo-plaza',
  name: 'Innovo Plaza',
  lat: 5.8325762,
  lon: -73.0321686,
  radiusM: 93,
  tenants: [
    { id: 't1', name: 'Puerto Madero', mcc: '5812', mccSource: 'hand-seeded' },
    { id: 't2', name: 'Frutin', mcc: '5451', mccSource: 'hand-seeded' },
    { id: 't3', name: 'Comida rapida A', mcc: '5814', mccSource: 'hand-seeded' },
    { id: 't4', name: 'Ropa B', mcc: '5651', mccSource: 'hand-seeded' },
  ],
};

const INSIDE = { lat: INNOVO.lat, lon: INNOVO.lon };

describe('inside a mall, location resolves the building and not the store', () => {
  it('returns every store as a candidate, with no distance trimming', () => {
    const result = resolveNearby(INSIDE, 25, [], [INNOVO]);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.venue?.name).toBe('Innovo Plaza');
    expect(result.candidates).toHaveLength(INNOVO.tenants.length);
    // Trimming by distance inside the building would drop candidates by a criterion
    // that does not exist: they all sit at the same effective distance.
    expect(new Set(result.candidates.map((c) => c.distanceM))).toEqual(new Set([0]));
  });

  it('triggers when the uncertainty circle overlaps the building', () => {
    // At 150 m from the centroid, with an 80 m fix, the user may well be inside:
    // 150 <= 93 + 80. Requiring the point to land inside the footprint would treat
    // the coordinate as exact.
    const nearby = { lat: INNOVO.lat + 150 / 111_320, lon: INNOVO.lon };

    const loose = resolveNearby(nearby, 80, [], [INNOVO]);
    expect(loose.status).toBe('ok');
    if (loose.status === 'ok') expect(loose.venue?.id).toBe('innovo-plaza');

    // With a good fix, that same point is clearly outside.
    const tight = resolveNearby(nearby, 10, [], [INNOVO]);
    expect(tight.status).toBe('no-candidates');
  });

  it('still rejects the fix when accuracy is not good enough', () => {
    const result = resolveNearby(INSIDE, PRECISION.unusableAccuracyM + 1, [], [
      INNOVO,
    ]);
    expect(result.status).toBe('accuracy-too-low');
  });

  it('ignores venues with no seeded stores yet', () => {
    const empty: Venue = { ...INNOVO, tenants: [] };
    const result = resolveNearby(INSIDE, 25, [], [empty]);
    expect(result.status).toBe('no-candidates');
  });

  it('lets convergence do the disambiguation GPS cannot', () => {
    const result = resolveNearby(INSIDE, 25, [], [INNOVO]);
    if (result.status !== 'ok') throw new Error('expected an ok result');

    const decision = decide(result.candidates, CARDS);

    // Four stores mixing food and clothing MCCs do not converge, so asking is
    // unavoidable. But the question is grouped by answer, not by store.
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;
    expect(decision.groups.length).toBeLessThan(INNOVO.tenants.length);
  });

  it('asks nothing when every store in the venue shares the same answer', () => {
    const foodOnly: Venue = {
      ...INNOVO,
      tenants: INNOVO.tenants.filter((t) => t.mcc === '5812' || t.mcc === '5814'),
    };

    const result = resolveNearby(INSIDE, 25, [], [foodOnly]);
    if (result.status !== 'ok') throw new Error('expected an ok result');

    expect(decide(result.candidates, CARDS).kind).toBe('converged');
  });
});
