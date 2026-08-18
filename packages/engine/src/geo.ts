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
 * Umbrales de precision del demo.
 *
 * unusableAccuracyM es una decision de producto, no un limite de plataforma: por
 * encima de ese error el circulo de incertidumbre cubre decenas de locales en una
 * zona densa y la ubicacion deja de ser un filtro util. Preferimos decirlo antes
 * que devolver una lista que aparenta precision que no tenemos.
 *
 * Referencia de por que esto importa: el modo aproximado de Android da unos 3
 * kilometros cuadrados, y el reduced accuracy de iOS entre 1 y 20 km.
 */
export const PRECISION = {
  unusableAccuracyM: 500,
  minRadiusM: 75,
  maxRadiusM: 400,
} as const;

/** El radio de busqueda sigue al error reportado, acotado por arriba y por abajo. */
export function candidateRadiusM(accuracyM: number): number {
  const scaled = accuracyM * 2;
  return Math.min(PRECISION.maxRadiusM, Math.max(PRECISION.minRadiusM, scaled));
}

export type NearbyResult =
  | {
      status: 'ok';
      radiusM: number;
      candidates: MerchantCandidate[];
      /** Presente cuando el fix cayo dentro de un edificio con locales adentro. */
      venue?: { id: string; name: string };
    }
  | { status: 'accuracy-too-low'; accuracyM: number; thresholdM: number }
  | { status: 'no-candidates'; radiusM: number };

/**
 * Encuentra el venue que contiene al punto, si hay alguno.
 *
 * Si el usuario esta adentro de un mall, el GPS no va a distinguir un local de
 * otro, asi que la respuesta correcta no es "el local mas cercano": es "estas en
 * este edificio, y estos son sus locales".
 */
function containingVenue(
  point: Coords,
  accuracyM: number,
  venues: Venue[],
): Venue | null {
  let best: { venue: Venue; distanceM: number } | null = null;

  for (const venue of venues) {
    const distanceM = haversineM(point, venue);
    // Se suma el error del fix: si el circulo de incertidumbre solapa el edificio,
    // el usuario puede estar adentro. Exigir que el punto caiga exacto dentro de la
    // huella seria tratar la coordenada como si fuera exacta.
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
    // Sin limite y sin ordenar por distancia: adentro del edificio todos los
    // locales estan a la misma distancia efectiva. Recortar la lista aca seria
    // descartar candidatos por un criterio que no existe.
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
