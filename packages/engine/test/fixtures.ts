import type { Merchant } from '../src/types';

/**
 * Comercios de prueba. Coordenadas cerca de South Coast Plaza, Costa Mesa, sur de
 * California. Son inventadas a nivel de metros: sirven para ejercitar la geometria,
 * no para navegar. El seed real se genera desde OpenStreetMap.
 */
const BASE_LAT = 33.6903;
const BASE_LON = -117.8887;

/** Desplaza unos metros desde el punto base, para armar racimos de comercios. */
function at(northM: number, eastM: number): { lat: number; lon: number } {
  const dLat = northM / 111_320;
  const dLon = eastM / (111_320 * Math.cos((BASE_LAT * Math.PI) / 180));
  return { lat: BASE_LAT + dLat, lon: BASE_LON + dLon };
}

export const ORIGIN = { lat: BASE_LAT, lon: BASE_LON };

export const TARGET: Merchant = {
  id: 'target-costa-mesa',
  name: 'Target',
  mcc: '5310',
  mccSource: 'community',
  brandId: 'target',
  ...at(20, 10),
};

export const SUPERMARKET: Merchant = {
  id: 'ralphs-costa-mesa',
  name: 'Ralphs',
  mcc: '5411',
  mccSource: 'visa-supplier-locator',
  ...at(40, -30),
};

export const WHOLESALE_CLUB: Merchant = {
  id: 'costco-costa-mesa',
  name: 'Costco',
  mcc: '5300',
  mccSource: 'community',
  ...at(-60, 50),
};

export const GAS_STATION: Merchant = {
  id: 'shell-harbor-blvd',
  name: 'Shell (caja interior)',
  mcc: '5541',
  mccSource: 'inferred-from-osm',
  ...at(-25, -45),
};

/** Mismo surtidor fisico que GAS_STATION, pagando en la bomba. */
export const FUEL_PUMP: Merchant = {
  id: 'shell-harbor-blvd-pump',
  name: 'Shell (surtidor)',
  mcc: '5542',
  mccSource: 'inferred-from-osm',
  ...at(-25, -44),
};

/** Ocho locales de un food court, todos MCC de comida. */
export const FOOD_COURT: Merchant[] = [
  { id: 'fc-1', name: 'Panda Express', mcc: '5814' },
  { id: 'fc-2', name: 'Chipotle', mcc: '5814' },
  { id: 'fc-3', name: 'Shake Shack', mcc: '5814' },
  { id: 'fc-4', name: 'Din Tai Fung', mcc: '5812' },
  { id: 'fc-5', name: 'Sushi Roku', mcc: '5812' },
  { id: 'fc-6', name: 'Blaze Pizza', mcc: '5814' },
  { id: 'fc-7', name: 'True Food Kitchen', mcc: '5812' },
  { id: 'fc-8', name: 'Nordstrom Cafe', mcc: '5812' },
].map((m, i) => ({
  ...m,
  mccSource: 'inferred-from-osm' as const,
  ...at(5 + i, 5 + i),
}));

/** Un racimo mixto: seis locales de comida y dos superstores pegados. */
export const MIXED_CLUSTER: Merchant[] = [
  ...FOOD_COURT.slice(0, 6),
  TARGET,
  { ...WHOLESALE_CLUB, ...at(25, 15) },
];
