import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { MCC_CATALOG } from '../src/mcc';
import { recommend } from '../src/recommend';
import { resolveNearby } from '../src/geo';
import type { Merchant } from '../src/types';

/**
 * Valida el seed generado desde OpenStreetMap. No prueba el motor: prueba que el
 * pipeline de datos sigue produciendo algo con el que el motor pueda trabajar, y
 * que los escenarios que necesita el demo siguen presentes despues de regenerarlo.
 */
const SEED_PATH = resolve(
  import.meta.dirname,
  '../../../data/merchants.costa-mesa.json',
);

type Seed = {
  region: string;
  attribution: string;
  license: string;
  bbox: { south: number; west: number; north: number; east: number };
  merchants: Array<Merchant & { osmId: string }>;
};

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Seed;

describe('el seed de Costa Mesa', () => {
  it('lleva atribucion y licencia, que ODbL exige', () => {
    expect(seed.attribution).toBe('(c) OpenStreetMap contributors');
    expect(seed.license).toBe('ODbL 1.0');
  });

  it('usa solo MCC que el catalogo sabe nombrar', () => {
    const unknown = [
      ...new Set(seed.merchants.map((m) => m.mcc)),
    ].filter((mcc) => !MCC_CATALOG[mcc]);

    // Un MCC sin titulo llegaria a la UI como "MCC 1234 (sin titulo)", que es peor
    // que no mostrarlo. Si el mapa de OSM crece, el catalogo tiene que crecer igual.
    expect(unknown).toEqual([]);
  });

  it('deja todos los comercios dentro del bounding box declarado', () => {
    for (const m of seed.merchants) {
      expect(m.lat).toBeGreaterThanOrEqual(seed.bbox.south);
      expect(m.lat).toBeLessThanOrEqual(seed.bbox.north);
      expect(m.lon).toBeGreaterThanOrEqual(seed.bbox.west);
      expect(m.lon).toBeLessThanOrEqual(seed.bbox.east);
    }
  });

  it('marca como community, no como inferido, todo MCC de marca conocida', () => {
    const superstores = seed.merchants.filter(
      (m) => m.mcc === '5310' || m.mcc === '5300',
    );

    expect(superstores.length).toBeGreaterThan(0);
    for (const m of superstores) {
      expect(m.mccSource).toBe('community');
      expect(m.brandId).toBeTruthy();
    }
  });

  it('conserva los escenarios que el demo necesita', () => {
    const byMcc = (mcc: string) => seed.merchants.filter((m) => m.mcc === mcc);

    expect(byMcc('5411').length).toBeGreaterThan(0); // supermercado de verdad
    expect(byMcc('5310').length).toBeGreaterThan(0); // superstore
    expect(byMcc('5300').length).toBeGreaterThan(0); // warehouse club
    expect(byMcc('5541').length).toBeGreaterThan(0); // gasolinera
    expect(byMcc('5812').length).toBeGreaterThan(0); // restaurante
    expect(byMcc('5814').length).toBeGreaterThan(0); // comida rapida
  });

  it('tiene una gasolinera de club mayorista, que es el caso fino', () => {
    const clubGas = seed.merchants.filter(
      (m) => m.mcc === '5541' && m.brandId !== undefined,
    );

    expect(clubGas.length).toBeGreaterThan(0);

    // Mismo MCC que una gasolinera normal, respuesta distinta.
    const plain = seed.merchants.find(
      (m) => m.mcc === '5541' && m.brandId === undefined,
    );
    expect(plain).toBeDefined();
    expect(recommend(clubGas[0]!, CARDS).winner.cardId).not.toBe(
      recommend(plain!, CARDS).winner.cardId,
    );
  });

  it('produce candidatos reales al resolver alrededor de un superstore', () => {
    const target = seed.merchants.find((m) => m.mcc === '5310');
    expect(target).toBeDefined();

    const result = resolveNearby(target!, 30, seed.merchants);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.candidates[0]?.id).toBe(target!.id);
  });

  it('no revienta el motor con ningun comercio del set', () => {
    for (const m of seed.merchants) {
      const rec = recommend(m, CARDS);
      expect(rec.winner.valuePerDollar).toBeGreaterThan(0);
    }
  });
});
