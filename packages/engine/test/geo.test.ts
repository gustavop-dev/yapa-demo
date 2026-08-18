import { describe, expect, it } from 'vitest';
import {
  PRECISION,
  candidateRadiusM,
  haversineM,
  resolveNearby,
} from '../src/geo';
import { geohash, buildConfirmation } from '../src/privacy';
import { FOOD_COURT, ORIGIN, TARGET } from './fixtures';

describe('location is a candidate filter, not an answer', () => {
  it('rejects the fix when horizontal error is above the usable threshold', () => {
    // Android approximate mode gives about 3 square kilometers. With that error the
    // candidate list would fake a precision we do not have.
    const result = resolveNearby(ORIGIN, 1500, [TARGET, ...FOOD_COURT]);

    expect(result.status).toBe('accuracy-too-low');
    if (result.status !== 'accuracy-too-low') return;
    expect(result.thresholdM).toBe(PRECISION.unusableAccuracyM);
  });

  it('widens the search radius when the fix is worse', () => {
    expect(candidateRadiusM(5)).toBe(PRECISION.minRadiusM);
    expect(candidateRadiusM(100)).toBe(200);
    expect(candidateRadiusM(450)).toBe(PRECISION.maxRadiusM);
  });

  it('returns candidates sorted by distance', () => {
    const result = resolveNearby(ORIGIN, 20, [TARGET, ...FOOD_COURT]);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const distances = result.candidates.map((c) => c.distanceM);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('tells finding nothing apart from not being able to locate', () => {
    const faraway = { lat: 40.7128, lon: -74.006 };
    const result = resolveNearby(faraway, 20, [TARGET]);
    expect(result.status).toBe('no-candidates');
  });

  it('measures distances in sane meters', () => {
    const oneDegreeNorth = { lat: ORIGIN.lat + 1, lon: ORIGIN.lon };
    expect(haversineM(ORIGIN, oneDegreeNorth)).toBeGreaterThan(110_000);
    expect(haversineM(ORIGIN, oneDegreeNorth)).toBeLessThan(112_000);
  });
});

describe('what gets persisted after a confirmation', () => {
  it('stores a level 6 geohash, which stays outside the Maryland definition', () => {
    const confirmation = buildConfirmation(
      TARGET.id,
      TARGET,
      new Date('2026-08-18T14:30:00'),
    );

    expect(confirmation.geohash6).toHaveLength(6);
    expect(confirmation.merchantId).toBe(TARGET.id);
    expect(confirmation.hourBucket).toBe(14);
  });

  it('includes no raw coordinates in any field', () => {
    const confirmation = buildConfirmation(TARGET.id, TARGET, new Date());
    const keys = Object.keys(confirmation);

    expect(keys).toEqual(['merchantId', 'geohash6', 'hourBucket']);
    expect(JSON.stringify(confirmation)).not.toContain(String(TARGET.lat));
    expect(JSON.stringify(confirmation)).not.toContain(String(TARGET.lon));
  });

  it('encodes geohashes against known reference values', () => {
    // Canonical example from the spec: ezs42 decodes to (42.6, -5.6).
    expect(geohash({ lat: 42.6, lon: -5.6 }, 5)).toBe('ezs42');
    expect(geohash({ lat: 51.5074, lon: -0.1278 }, 6)).toBe('gcpvj0');
    expect(geohash({ lat: 48.8583, lon: 2.2945 }, 6)).toBe('u09tun');
  });

  it('puts merchants on the same block into the same level 6 cell', () => {
    const a = geohash(TARGET, 6);
    const b = geohash(FOOD_COURT[0]!, 6);
    expect(a).toBe(b);
  });
});
