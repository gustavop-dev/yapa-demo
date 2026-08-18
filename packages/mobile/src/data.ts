import type { Merchant } from '@yapa/engine';
import costaMesa from './data/merchants.costa-mesa.json';
import duitama from './data/merchants.duitama.json';

/**
 * The merchant sets are embedded in the binary.
 *
 * This is not a limitation of the demo, it is the architecture: candidate resolution
 * happens on device, which is why the backend never receives a coordinate. That is not
 * a privacy policy promise, it is a property of the protocol.
 *
 * In production a whole country catalog cannot be shipped, and the answer there is
 * Overture Maps with a spatial index on our own backend, served by coarse geographic
 * cell. Google Places cannot do that job: its ToS forbids storing names and categories.
 *
 * Regenerate with: npm run sync-data --workspace=@yapa/mobile
 */

export type Region = {
  id: string;
  label: string;
  merchants: Merchant[];
  /** A point with real density, for rehearsing and for simulating location. */
  demoPoint: { lat: number; lon: number; note: string };
};

export const REGIONS: Region[] = [
  {
    id: 'duitama',
    label: 'Duitama, Boyaca',
    merchants: duitama.merchants as Merchant[],
    demoPoint: {
      lat: 5.823085,
      lon: -73.037776,
      note: 'Zona mas densa del seed: 8 candidatos y 5 MCC distintos.',
    },
  },
  {
    id: 'costa-mesa',
    label: 'Costa Mesa, California',
    merchants: costaMesa.merchants as Merchant[],
    demoPoint: {
      lat: 33.702859,
      lon: -117.887642,
      note: 'Target, MCC 5310. El caso canonico de exclusion de supermercados.',
    },
  },
];

/** Every merchant together: the real fix decides which region it lands in. */
export const ALL_MERCHANTS: Merchant[] = REGIONS.flatMap((r) => r.merchants);

export const ATTRIBUTION = '(c) OpenStreetMap contributors, ODbL 1.0';
