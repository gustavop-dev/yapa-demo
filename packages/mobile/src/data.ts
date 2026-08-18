import type { Merchant } from '@yapa/engine';
import costaMesa from './data/merchants.costa-mesa.json';
import duitama from './data/merchants.duitama.json';

/**
 * Los sets de comercios van embebidos en el binario.
 *
 * Esto no es una limitacion del demo, es la arquitectura: la resolucion de candidatos
 * ocurre en el dispositivo, y por eso el backend nunca recibe una coordenada. No es
 * una promesa de politica de privacidad, es una propiedad del protocolo.
 *
 * En produccion no se puede embarcar el catalogo de un pais entero, y ahi la respuesta
 * es Overture Maps con indice espacial en backend propio, sirviendo por celda
 * geografica gruesa. Google Places no sirve para eso: su ToS prohibe almacenar
 * nombres y categorias.
 *
 * Regenerar con: npm run sync-data --workspace=@yapa/mobile
 */

export type Region = {
  id: string;
  label: string;
  merchants: Merchant[];
  /** Un punto con densidad real, para ensayar y para simular ubicacion. */
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

/** Todos los comercios juntos: el fix real decide en cual region cae. */
export const ALL_MERCHANTS: Merchant[] = REGIONS.flatMap((r) => r.merchants);

export const ATTRIBUTION = '(c) OpenStreetMap contributors, ODbL 1.0';
