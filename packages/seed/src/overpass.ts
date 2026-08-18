import type { BBox } from './regions';
import type { OsmTags } from './mcc-map';

/**
 * Cliente minimo de la Overpass API de OpenStreetMap.
 *
 * Uso previsto: extraccion puntual para generar un seed, no backend de produccion.
 * La propia politica de uso de la instancia publica lista como problematico
 * "setting up an app for more than just OSM mappers and relying on the public
 * instances as backend", y orienta a un maximo de unas 10.000 peticiones y menos
 * de 1 GB por dia. Este script hace una peticion por region.
 *
 * Licencia de los datos: ODbL. Requiere atribuir "(c) OpenStreetMap contributors".
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
 * Estados que valen un reintento: la instancia publica devuelve 429 cuando estas
 * sobre cuota y 504 cuando esta saturada, y ambos se resuelven esperando. Un 400
 * es una query mal escrita y reintentar no arregla nada.
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
          // La politica de uso pide identificarse para poder contactar si molesta.
          'User-Agent': 'yapa-demo-seed/0.1 (demo tecnico, extraccion puntual)',
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === attempts) break;
      const wait = 5_000 * attempt;
      console.warn(`  red fallo (${lastError}), reintento en ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }

    if (response.ok) {
      const body = (await response.json()) as { elements?: OsmElement[] };
      return body.elements ?? [];
    }

    if (!RETRYABLE.has(response.status)) {
      throw new Error(
        `Overpass devolvio ${response.status}: ${await response.text()}`,
      );
    }

    lastError = `HTTP ${response.status}`;
    if (attempt === attempts) break;

    const wait = 10_000 * attempt;
    console.warn(
      `  Overpass devolvio ${response.status} (instancia publica saturada o sobre ` +
        `cuota), reintento en ${wait / 1000}s`,
    );
    await sleep(wait);
  }

  throw new Error(
    `Overpass no respondio despues de ${attempts} intentos (ultimo: ${lastError}). ` +
      'Es una instancia publica compartida: su politica de uso la limita a unas ' +
      '10.000 peticiones y menos de 1 GB por dia, y desaconseja usarla como backend. ' +
      'Para produccion hay que montar instancia propia o usar Overture Maps.',
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
