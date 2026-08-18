import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { MCC_CATALOG } from '../src/mcc';
import { recommend } from '../src/recommend';
import { resolveNearby } from '../src/geo';
import type { Merchant } from '../src/types';

/**
 * Validates the seed generated from OpenStreetMap. It does not test the engine: it
 * tests that the data pipeline keeps producing something the engine can work with, and
 * that the scenarios the demo needs survive a regeneration.
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

describe('the Costa Mesa seed', () => {
  it('carries the attribution and license ODbL requires', () => {
    expect(seed.attribution).toBe('(c) OpenStreetMap contributors');
    expect(seed.license).toBe('ODbL 1.0');
  });

  it('uses only MCCs the catalog can name', () => {
    const unknown = [
      ...new Set(seed.merchants.map((m) => m.mcc)),
    ].filter((mcc) => !MCC_CATALOG[mcc]);

    // An MCC with no title would reach the UI as "MCC 1234 (sin titulo)", which is
    // worse than not showing it. If the OSM map grows, the catalog has to grow too.
    expect(unknown).toEqual([]);
  });

  it('keeps every merchant inside the declared bounding box', () => {
    for (const m of seed.merchants) {
      expect(m.lat).toBeGreaterThanOrEqual(seed.bbox.south);
      expect(m.lat).toBeLessThanOrEqual(seed.bbox.north);
      expect(m.lon).toBeGreaterThanOrEqual(seed.bbox.west);
      expect(m.lon).toBeLessThanOrEqual(seed.bbox.east);
    }
  });

  it('marks every known brand MCC as community, not as inferred', () => {
    const superstores = seed.merchants.filter(
      (m) => m.mcc === '5310' || m.mcc === '5300',
    );

    expect(superstores.length).toBeGreaterThan(0);
    for (const m of superstores) {
      expect(m.mccSource).toBe('community');
      expect(m.brandId).toBeTruthy();
    }
  });

  it('preserves the scenarios the demo needs', () => {
    const byMcc = (mcc: string) => seed.merchants.filter((m) => m.mcc === mcc);

    expect(byMcc('5411').length).toBeGreaterThan(0); // real supermarket
    expect(byMcc('5310').length).toBeGreaterThan(0); // superstore
    expect(byMcc('5300').length).toBeGreaterThan(0); // warehouse club
    expect(byMcc('5541').length).toBeGreaterThan(0); // gas station
    expect(byMcc('5812').length).toBeGreaterThan(0); // restaurant
    expect(byMcc('5814').length).toBeGreaterThan(0); // fast food
  });

  it('has a warehouse club gas station, which is the subtle case', () => {
    const clubGas = seed.merchants.filter(
      (m) => m.mcc === '5541' && m.brandId !== undefined,
    );

    expect(clubGas.length).toBeGreaterThan(0);

    // Same MCC as a regular gas station, different answer.
    const plain = seed.merchants.find(
      (m) => m.mcc === '5541' && m.brandId === undefined,
    );
    expect(plain).toBeDefined();
    expect(recommend(clubGas[0]!, CARDS).winner.cardId).not.toBe(
      recommend(plain!, CARDS).winner.cardId,
    );
  });

  it('produces real candidates when resolving around a superstore', () => {
    const target = seed.merchants.find((m) => m.mcc === '5310');
    expect(target).toBeDefined();

    const result = resolveNearby(target!, 30, seed.merchants);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.candidates[0]?.id).toBe(target!.id);
  });

  it('does not break the engine with any merchant in the set', () => {
    for (const m of seed.merchants) {
      const rec = recommend(m, CARDS);
      expect(rec.winner.valuePerDollar).toBeGreaterThan(0);
    }
  });
});
