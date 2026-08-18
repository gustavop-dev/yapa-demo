export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type Region = {
  id: string;
  label: string;
  bbox: BBox;
  note: string;
};

/**
 * Region notes stay in Spanish: they are copied verbatim into the generated seed
 * files under data/, so translating them here would drift from what is committed.
 */
export const REGIONS: Record<string, Region> = {
  'costa-mesa': {
    id: 'costa-mesa',
    label: 'Costa Mesa, California',
    bbox: { south: 33.67, west: -117.94, north: 33.708, east: -117.87 },
    note:
      'South Coast Plaza y el corredor de Harbor Blvd, extendido al oeste para ' +
      'alcanzar un club mayorista. Elegida porque en el mismo radio conviven un mall ' +
      'cerrado (el argumento de interiores), supermercados MCC 5411, un superstore ' +
      'MCC 5310, un warehouse club MCC 5300 y gasolineras, incluida una de club ' +
      'mayorista. Es el set que va al repo.',
  },
  duitama: {
    id: 'duitama',
    label: 'Duitama, Boyaca, Colombia',
    bbox: { south: 5.815, west: -73.045, north: 5.835, east: -73.02 },
    note:
      'Innovo Plaza y el centro de Duitama. Existe solo para grabar el video con ' +
      'el telefono en un mall real. Los MCC son ISO 18245, el mismo estandar en ' +
      'todo el mundo, asi que el motor no cambia.',
  },
};

export function regionOrThrow(id: string): Region {
  const region = REGIONS[id];
  if (!region) {
    const known = Object.keys(REGIONS).join(', ');
    throw new Error(`Unknown region: "${id}". Known regions: ${known}`);
  }
  return region;
}
