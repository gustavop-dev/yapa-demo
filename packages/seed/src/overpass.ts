import type { BBox } from './regions';
import type { OsmTags } from './mcc-map';

/**
 * Minimal client for the OpenStreetMap Overpass API.
 *
 * Intended use: one off extraction to generate a seed, not a production backend. The
 * public instance usage policy itself lists as problematic "setting up an app for more
 * than just OSM mappers and relying on the public instances as backend", and points at
 * a ceiling of about 10,000 requests and under 1 GB per day. This script makes one
 * request per region.
 *
 * Data license: ODbL. Requires attributing "(c) OpenStreetMap contributors".
 */
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

const SHOP_VALUES = [
  'supermarket',
  'department_store',
  'wholesale',
  'convenience',
  'variety_store',
  'chemist',
  'clothes',
  'electronics',
  'books',
  'hardware',
  'doityourself',
  'bakery',
  'confectionery',
  'butcher',
  'greengrocer',
].join('|');

const AMENITY_VALUES = [
  'restaurant',
  'fast_food',
  'cafe',
  'ice_cream',
  'bar',
  'pub',
  'fuel',
  'pharmacy',
].join('|');

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

export function buildQuery(bbox: BBox): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:90];
(
  nwr["shop"~"^(${SHOP_VALUES})$"](${b});
  nwr["amenity"~"^(${AMENITY_VALUES})$"](${b});
);
out center tags;`;
}

/**
 * Statuses worth a retry: the public instance returns 429 when you are over quota and
 * 504 when it is saturated, and both resolve by waiting. A 400 is a badly written
 * query and retrying fixes nothing.
 */
const RETRYABLE = new Set([429, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runQuery(query: string, attempts = 4): Promise<OsmElement[]> {
  let lastError = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // The usage policy asks for identification so they can reach you if the
          // traffic becomes a problem.
          'User-Agent': 'yapa-demo-seed/0.1 (demo tecnico, extraccion puntual)',
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === attempts) break;
      const wait = 5_000 * attempt;
      console.warn(`  network failed (${lastError}), retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }

    if (response.ok) {
      const body = (await response.json()) as { elements?: OsmElement[] };
      return body.elements ?? [];
    }

    if (!RETRYABLE.has(response.status)) {
      throw new Error(
        `Overpass returned ${response.status}: ${await response.text()}`,
      );
    }

    lastError = `HTTP ${response.status}`;
    if (attempt === attempts) break;

    const wait = 10_000 * attempt;
    console.warn(
      `  Overpass returned ${response.status} (public instance saturated or over ` +
        `quota), retrying in ${wait / 1000}s`,
    );
    await sleep(wait);
  }

  throw new Error(
    `Overpass did not answer after ${attempts} attempts (last: ${lastError}). ` +
      'It is a shared public instance: its usage policy caps it at about 10,000 ' +
      'requests and under 1 GB per day, and discourages using it as a backend. ' +
      'Production needs a self hosted instance or Overture Maps.',
  );
}

export async function fetchOverpass(bbox: BBox): Promise<OsmElement[]> {
  return runQuery(buildQuery(bbox));
}

export function coordsOf(el: OsmElement): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center) return el.center;
  return null;
}
