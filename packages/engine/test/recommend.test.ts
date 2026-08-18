import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { recommend } from '../src/recommend';
import type { Merchant } from '../src/types';
import {
  FUEL_PUMP,
  GAS_STATION,
  SUPERMARKET,
  TARGET,
  WHOLESALE_CLUB,
} from './fixtures';

describe('the canonical US case: Target is not a supermarket', () => {
  it('does not apply the supermarket rule to MCC 5310, so the flat rate wins', () => {
    const rec = recommend(TARGET, CARDS);

    expect(rec.mcc.code).toBe('5310');
    expect(rec.mcc.title).toBe('Discount Stores');
    expect(rec.winner.cardId).toBe('citi-double-cash');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.02);
  });

  it('explains the exclusion by quoting the issuer, not just the number', () => {
    const rec = recommend(TARGET, CARDS);

    const bcpSupermarkets = rec.rejected.find(
      (r) => r.rule.id === 'amex-bcp-supermarkets',
    );

    expect(bcpSupermarkets).toBeDefined();
    expect(bcpSupermarkets?.kind).toBe('explicitly-excluded');
    // Amex Blue Cash Preferred, Card Member Agreement, as of 10/08/2025.
    expect(bcpSupermarkets?.reason).toContain(
      'superstores, convenience stores, warehouse clubs',
    );
  });

  it('lists as rejected every rule that would have won if it applied', () => {
    const rec = recommend(TARGET, CARDS);
    const rejectedIds = rec.rejected.map((r) => r.rule.id);

    // BCP 6% and Gold 4x are worth more than the winning 2%, so the user deserves to
    // know why they cannot use them.
    expect(rejectedIds).toContain('amex-bcp-supermarkets');
    expect(rejectedIds).toContain('amex-gold-supermarkets');
  });

  it('treats the warehouse club the same as the superstore', () => {
    const rec = recommend(WHOLESALE_CLUB, CARDS);

    expect(rec.mcc.code).toBe('5300');
    expect(rec.winner.cardId).toBe('citi-double-cash');
    expect(
      rec.rejected.some(
        (r) =>
          r.rule.id === 'amex-bcp-supermarkets' &&
          r.kind === 'explicitly-excluded',
      ),
    ).toBe(true);
  });
});

describe('a real supermarket does trigger the category', () => {
  it('picks the Blue Cash Preferred 6% over the Gold 4x', () => {
    const rec = recommend(SUPERMARKET, CARDS);

    expect(rec.mcc.code).toBe('5411');
    expect(rec.winner.cardId).toBe('amex-bcp');
    expect(rec.winner.rule.id).toBe('amex-bcp-supermarkets');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.06);
    expect(rec.winner.valueIsEstimated).toBe(false);
  });

  it('marks the valuation as estimated when the card earns points', () => {
    const rec = recommend(SUPERMARKET, CARDS);
    const gold = rec.rejected.find((r) => r.cardId === 'amex-gold');

    expect(gold).toBeDefined();
    expect(gold?.kind).toBe('lower-value');
  });
});

describe('5541 versus 5542: same pump, different MCC', () => {
  it('pays with the 3% card when the MCC is 5541 (Service Stations)', () => {
    const rec = recommend(GAS_STATION, CARDS);

    expect(rec.winner.cardId).toBe('amex-bcp');
    expect(rec.winner.rule.id).toBe('amex-bcp-gas');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.03);
  });

  it('does not guess on 5542: it reports the uncertainty and falls to the flat rate', () => {
    const rec = recommend(FUEL_PUMP, CARDS);

    expect(rec.mcc.code).toBe('5542');
    expect(rec.winner.cardId).toBe('citi-double-cash');

    const gas = rec.rejected.find((r) => r.rule.id === 'amex-bcp-gas');
    expect(gas?.kind).toBe('uncertain-coverage');
    expect(gas?.reason).toContain('No sabemos');
  });
});

describe('brand exclusions: the MCC is necessary but not sufficient', () => {
  const chevron: Merchant = {
    id: 'chevron',
    name: 'Chevron',
    mcc: '5541',
    mccSource: 'inferred-from-osm',
    lat: 33.69,
    lon: -117.889,
  };

  const costcoGas: Merchant = {
    id: 'costco-gasoline',
    name: 'Costco Gasoline',
    mcc: '5541',
    mccSource: 'inferred-from-osm',
    brandId: 'costco',
    lat: 33.702,
    lon: -117.931,
  };

  it('gives different answers for two gas stations sharing an MCC', () => {
    const a = recommend(chevron, CARDS);
    const b = recommend(costcoGas, CARDS);

    expect(a.mcc.code).toBe(b.mcc.code);
    expect(a.winner.cardId).toBe('amex-bcp');
    expect(b.winner.cardId).toBe('citi-double-cash');
  });

  it('explains that the exclusion is by brand name, not by category', () => {
    const rec = recommend(costcoGas, CARDS);
    const gas = rec.rejected.find((r) => r.rule.id === 'amex-bcp-gas');

    expect(gas?.kind).toBe('explicitly-excluded');
    expect(gas?.reason).toContain('por nombre, no por categoria');
    // Blue Cash Preferred, Card Member Agreement, as of 10/08/2025.
    expect(gas?.reason).toContain('warehouse clubs that sell gasoline');
  });
});

describe('catalog honesty', () => {
  it('marks as unverified every rule with no cited source', () => {
    for (const card of CARDS) {
      for (const rule of card.rules) {
        if (rule.provenance.verified) {
          expect(rule.provenance.sourceQuote).toBeTruthy();
          expect(rule.provenance.sourceUrl).toBeTruthy();
        } else {
          expect(rule.provenance.todo).toBeTruthy();
        }
      }
    }
  });

  it('makes every points card declare that its valuation is our own assumption', () => {
    for (const card of CARDS) {
      if (card.pointValueUsd !== null) {
        expect(card.pointValueNote).toContain('NO es un dato del emisor');
      }
    }
  });
});
