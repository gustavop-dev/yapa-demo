import type { Coords } from './types';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Precision de geohash que guardamos como dato de entrenamiento.
 *
 * Maryland define "precise geolocation" como lo que ubica al dispositivo dentro de
 * un radio de 1.750 pies (unos 533 m). Las celdas aproximadas por nivel:
 *
 *   nivel 5  ->  4,9 km x 4,9 km      queda fuera de la definicion
 *   nivel 6  ->  1,2 km x 0,61 km     queda fuera, por poco (610 m contra 533 m)
 *   nivel 7  ->  153 m x 153 m        cae dentro de la definicion
 *
 * O sea que la precision que haria util al prior es exactamente la que dispara las
 * reglas de dato sensible. Elegimos el nivel 6 a proposito.
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
 * Lo unico que se persiste despues de que el usuario confirma.
 *
 * No hay lat/lon crudos aca, y es a proposito: el backend no puede filtrar una
 * ubicacion que nunca recibio. Es una propiedad del protocolo, no una promesa de
 * la politica de privacidad.
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
