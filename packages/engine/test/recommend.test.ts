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

describe('el caso canonico de Estados Unidos: Target no es un supermercado', () => {
  it('no aplica la regla de supermercados en un MCC 5310, y gana la tasa plana', () => {
    const rec = recommend(TARGET, CARDS);

    expect(rec.mcc.code).toBe('5310');
    expect(rec.mcc.title).toBe('Discount Stores');
    expect(rec.winner.cardId).toBe('citi-double-cash');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.02);
  });

  it('explica la exclusion citando el texto del emisor, no solo el numero', () => {
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

  it('lista como rechazada toda regla que habria ganado si aplicara', () => {
    const rec = recommend(TARGET, CARDS);
    const rejectedIds = rec.rejected.map((r) => r.rule.id);

    // 6% de BCP y 4x de Gold valen mas que el 2% ganador, asi que el usuario
    // merece saber por que no las puede usar.
    expect(rejectedIds).toContain('amex-bcp-supermarkets');
    expect(rejectedIds).toContain('amex-gold-supermarkets');
  });

  it('trata al club mayorista igual que al superstore', () => {
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

describe('un supermercado de verdad si activa la categoria', () => {
  it('elige el 6% de Blue Cash Preferred sobre el 4x de Gold', () => {
    const rec = recommend(SUPERMARKET, CARDS);

    expect(rec.mcc.code).toBe('5411');
    expect(rec.winner.cardId).toBe('amex-bcp');
    expect(rec.winner.rule.id).toBe('amex-bcp-supermarkets');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.06);
    expect(rec.winner.valueIsEstimated).toBe(false);
  });

  it('marca como estimada la valoracion cuando la tarjeta acumula puntos', () => {
    const rec = recommend(SUPERMARKET, CARDS);
    const gold = rec.rejected.find((r) => r.cardId === 'amex-gold');

    expect(gold).toBeDefined();
    expect(gold?.kind).toBe('lower-value');
  });
});

describe('5541 contra 5542: el mismo surtidor, distinto MCC', () => {
  it('paga con la de 3% cuando el MCC es 5541 (Service Stations)', () => {
    const rec = recommend(GAS_STATION, CARDS);

    expect(rec.winner.cardId).toBe('amex-bcp');
    expect(rec.winner.rule.id).toBe('amex-bcp-gas');
    expect(rec.winner.valuePerDollar).toBeCloseTo(0.03);
  });

  it('no adivina en 5542: reporta la incertidumbre y cae a la tasa plana', () => {
    const rec = recommend(FUEL_PUMP, CARDS);

    expect(rec.mcc.code).toBe('5542');
    expect(rec.winner.cardId).toBe('citi-double-cash');

    const gas = rec.rejected.find((r) => r.rule.id === 'amex-bcp-gas');
    expect(gas?.kind).toBe('uncertain-coverage');
    expect(gas?.reason).toContain('No sabemos');
  });
});

describe('exclusiones por marca: el MCC es necesario pero no suficiente', () => {
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

  it('da respuestas distintas para dos gasolineras con el mismo MCC', () => {
    const a = recommend(chevron, CARDS);
    const b = recommend(costcoGas, CARDS);

    expect(a.mcc.code).toBe(b.mcc.code);
    expect(a.winner.cardId).toBe('amex-bcp');
    expect(b.winner.cardId).toBe('citi-double-cash');
  });

  it('explica que la exclusion es por nombre de marca, no por categoria', () => {
    const rec = recommend(costcoGas, CARDS);
    const gas = rec.rejected.find((r) => r.rule.id === 'amex-bcp-gas');

    expect(gas?.kind).toBe('explicitly-excluded');
    expect(gas?.reason).toContain('por nombre, no por categoria');
    // Blue Cash Preferred, Card Member Agreement, as of 10/08/2025.
    expect(gas?.reason).toContain('warehouse clubs that sell gasoline');
  });
});

describe('honestidad del catalogo', () => {
  it('toda regla sin fuente citada esta marcada como no verificada', () => {
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

  it('toda tarjeta de puntos declara que su valuacion es un supuesto propio', () => {
    for (const card of CARDS) {
      if (card.pointValueUsd !== null) {
        expect(card.pointValueNote).toContain('NO es un dato del emisor');
      }
    }
  });
});
