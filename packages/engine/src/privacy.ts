import type { Coords } from './types';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Geohash precision we store as training data.
 *
 * Maryland defines "precise geolocation" as anything that locates the device within a
 * 1,750 foot radius (about 533 m). Approximate cell sizes per level:
 *
 *   level 5  ->  4.9 km x 4.9 km      outside the definition
 *   level 6  ->  1.2 km x 0.61 km     outside, barely (610 m against 533 m)
 *   level 7  ->  153 m x 153 m        inside the definition
 *
 * So the precision that would make the prior useful is exactly the one that trips the
 * sensitive data rules. Level 6 is a deliberate choice.
 */
export const TRAINING_GEOHASH_PRECISION = 6;

export function geohash(point: Coords, precision: number): string {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  let hash = '';
  let bit = 0;
  let chunk = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (point.lon >= mid) {
        chunk = (chunk << 1) + 1;
        lonMin = mid;
      } else {
        chunk = chunk << 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (point.lat >= mid) {
        chunk = (chunk << 1) + 1;
        latMin = mid;
      } else {
        chunk = chunk << 1;
        latMax = mid;
      }
    }

    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      hash += BASE32[chunk];
      bit = 0;
      chunk = 0;
    }
  }

  return hash;
}

/**
 * The only thing persisted after the user confirms.
 *
 * There are no raw lat/lon here, on purpose: the backend cannot leak a location it
 * never received. That is a property of the protocol, not a promise in the privacy
 * policy.
 */
export type TrainingConfirmation = {
  merchantId: string;
  geohash6: string;
  hourBucket: number;
};

export function buildConfirmation(
  merchantId: string,
  point: Coords,
  at: Date,
): TrainingConfirmation {
  return {
    merchantId,
    geohash6: geohash(point, TRAINING_GEOHASH_PRECISION),
    hourBucket: at.getHours(),
  };
}
