import type { Coords, Merchant, MerchantCandidate, Venue } from './types';

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineM(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Accuracy thresholds for the demo.
 *
 * unusableAccuracyM is a product decision, not a platform limit: above that error the
 * uncertainty circle covers dozens of stores in a dense area and location stops being
 * a useful filter. We would rather say so than return a list that fakes a precision we
 * do not have.
 *
 * Why this matters: Android approximate mode gives about 3 square kilometers, and iOS
 * reduced accuracy is between 1 and 20 km.
 */
export const PRECISION = {
  unusableAccuracyM: 500,
  minRadiusM: 75,
  maxRadiusM: 400,
} as const;

/** The search radius follows the reported error, clamped at both ends. */
export function candidateRadiusM(accuracyM: number): number {
  const scaled = accuracyM * 2;
  return Math.min(PRECISION.maxRadiusM, Math.max(PRECISION.minRadiusM, scaled));
}

export type NearbyResult =
  | {
      status: 'ok';
      radiusM: number;
      candidates: MerchantCandidate[];
      /** Present when the fix landed inside a building that has stores in it. */
      venue?: { id: string; name: string };
    }
  | { status: 'accuracy-too-low'; accuracyM: number; thresholdM: number }
  | { status: 'no-candidates'; radiusM: number };

/**
 * Finds the venue containing the point, if there is one.
 *
 * If the user is inside a mall, GPS will not tell one store from another, so the right
 * answer is not "the closest store": it is "you are in this building, and these are
 * its stores".
 */
function containingVenue(
  point: Coords,
  accuracyM: number,
  venues: Venue[],
): Venue | null {
  let best: { venue: Venue; distanceM: number } | null = null;

  for (const venue of venues) {
    const distanceM = haversineM(point, venue);
    // The fix error is added in: if the uncertainty circle overlaps the building, the
    // user may well be inside. Requiring the point to fall exactly within the
    // footprint would treat the coordinate as if it were exact.
    if (distanceM > venue.radiusM + accuracyM) continue;
    if (best === null || distanceM < best.distanceM) best = { venue, distanceM };
  }

  return best?.venue ?? null;
}

export function resolveNearby(
  point: Coords,
  accuracyM: number,
  merchants: Merchant[],
  venues: Venue[] = [],
  limit = 8,
): NearbyResult {
  if (accuracyM > PRECISION.unusableAccuracyM) {
    return {
      status: 'accuracy-too-low',
      accuracyM,
      thresholdM: PRECISION.unusableAccuracyM,
    };
  }

  const radiusM = candidateRadiusM(accuracyM);

  const venue = containingVenue(point, accuracyM, venues);
  if (venue && venue.tenants.length > 0) {
    // No limit and no distance sorting: inside the building every store sits at the
    // same effective distance. Trimming the list here would drop candidates by a
    // criterion that does not exist.
    return {
      status: 'ok',
      radiusM: venue.radiusM,
      venue: { id: venue.id, name: venue.name },
      candidates: venue.tenants.map((t) => ({
        ...t,
        lat: venue.lat,
        lon: venue.lon,
        distanceM: 0,
      })),
    };
  }

  const candidates = merchants
    .map((m) => ({ ...m, distanceM: haversineM(point, m) }))
    .filter((m) => m.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);

  if (candidates.length === 0) return { status: 'no-candidates', radiusM };
  return { status: 'ok', radiusM, candidates };
}
