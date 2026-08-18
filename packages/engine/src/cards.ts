import type { Card } from './types';

/**
 * Card catalog for the demo.
 *
 * Project rule: rates are never made up. Every rule carries its provenance. The ones
 * with sourceQuote were read from the issuer document on August 18, 2026. The ones
 * with todo are unverified and the UI has to say so.
 *
 * Card labels and notes stay in Spanish because they are rendered in the app.
 *
 * Three cards are enough because their multipliers overlap, which is the only thing
 * that makes the problem interesting. Fifty made up cards prove nothing.
 */

const AMEX_SUPERMARKET_EXCLUSION_QUOTE =
  'Superstores, convenience stores, warehouse clubs, and meal-kit delivery ' +
  'services are not considered supermarkets.';

export const CARDS: Card[] = [
  {
    id: 'amex-gold',
    issuer: 'American Express',
    name: 'American Express Gold Card',
    currency: 'membership-rewards',
    pointValueUsd: 0.01,
    pointValueNote:
      'Estimacion propia de 0,01 USD por punto Membership Rewards, elegida como ' +
      'piso conservador. NO es un dato del emisor: Amex no publica un valor de ' +
      'canje unico y el valor real depende de como canjees. Existe solo para poder ' +
      'comparar puntos contra cash back, y la UI la muestra como supuesto. ' +
      'Cambiar este numero cambia recomendaciones, asi que es una decision de ' +
      'producto, no una constante.',
    rules: [
      {
        id: 'amex-gold-supermarkets',
        label: 'U.S. Supermarkets',
        rate: 4,
        unit: 'points-per-dollar',
        matchMcc: ['5411'],
        excludeMcc: ['5300', '5310', '5311'],
        cap: { amountUsd: 25_000, period: 'calendar-year' },
        provenance: {
          verified: true,
          sourceUrl:
            'https://www.americanexpress.com/content/dam/amex/us/rewards/membership-rewards/mr-terms-conditions-june-2026-v2.pdf',
          sourceDate: 'June 2026',
          sourceQuote:
            '3 additional points (for a total of 4 points) on the first $25,000 ' +
            'of eligible purchases in a calendar year at U.S. supermarkets. ' +
            AMEX_SUPERMARKET_EXCLUSION_QUOTE,
        },
      },
      {
        id: 'amex-gold-restaurants',
        label: 'Restaurants',
        rate: 4,
        unit: 'points-per-dollar',
        matchMcc: ['5812', '5814'],
        provenance: {
          verified: false,
          todo:
            'TODO: verify the current restaurant rate and its cap against the ' +
            'Membership Rewards terms. Only the U.S. supermarkets part was verified.',
        },
      },
      {
        id: 'amex-gold-base',
        label: 'Todo lo demas',
        rate: 1,
        unit: 'points-per-dollar',
        matchMcc: [],
        provenance: {
          verified: false,
          todo: 'TODO: verify the base rate against the current terms.',
        },
      },
    ],
  },

  {
    id: 'amex-bcp',
    issuer: 'American Express',
    name: 'Blue Cash Preferred',
    currency: 'usd-cashback',
    pointValueUsd: null,
    pointValueNote: 'Cash back directo, no requiere valuacion.',
    rules: [
      {
        id: 'amex-bcp-supermarkets',
        label: 'U.S. Supermarkets',
        rate: 0.06,
        unit: 'cash-back-pct',
        matchMcc: ['5411'],
        excludeMcc: ['5300', '5310', '5311'],
        cap: { amountUsd: 6_000, period: 'calendar-year' },
        provenance: {
          verified: true,
          sourceUrl:
            'https://www.americanexpress.com/content/dam/amex/en-us/company/legal/cardmember-agreements/public-site-adhoc-2025-10-08/cps-lending/blue-cash-preferred-10-08-2025.pdf',
          sourceDate: 'As of 10/08/2025',
          sourceQuote:
            '6 percent on the first $6,000 of eligible purchases in a calendar ' +
            'year at supermarkets located in the U.S. (superstores, convenience ' +
            'stores, warehouse clubs, and meal-kit delivery services are not ' +
            'considered supermarkets)',
        },
      },
      {
        id: 'amex-bcp-gas',
        label: 'U.S. Gas Stations',
        rate: 0.03,
        unit: 'cash-back-pct',
        matchMcc: ['5541'],
        excludeMcc: ['5300', '5310', '5411'],
        // The quote says "warehouse clubs that sell gasoline are not considered gas
        // stations". A Costco gas station is a gas station and codes as one, so the
        // exclusion has to be by brand and not by MCC.
        excludeBrandId: ['costco', 'sams-club', 'bjs', 'walmart', 'target'],
        uncertainMcc: ['5542'],
        provenance: {
          verified: true,
          sourceUrl:
            'https://www.americanexpress.com/content/dam/amex/en-us/company/legal/cardmember-agreements/public-site-adhoc-2025-10-08/cps-lending/blue-cash-preferred-10-08-2025.pdf',
          sourceDate: 'As of 10/08/2025',
          sourceQuote:
            '3 percent on eligible purchases of gasoline at gasoline stations ' +
            'located in the U.S. (superstores, supermarkets and warehouse clubs ' +
            'that sell gasoline are not considered gas stations)',
        },
      },
      {
        id: 'amex-bcp-base',
        label: 'Todo lo demas',
        rate: 0.01,
        unit: 'cash-back-pct',
        matchMcc: [],
        provenance: {
          verified: false,
          todo: 'TODO: verify the base rate against the current Card Member Agreement.',
        },
      },
    ],
  },

  {
    id: 'citi-double-cash',
    issuer: 'Citi',
    name: 'Citi Double Cash',
    currency: 'usd-cashback',
    pointValueUsd: null,
    pointValueNote: 'Cash back directo, no requiere valuacion.',
    rules: [
      {
        id: 'citi-double-cash-base',
        label: 'Todas las compras',
        rate: 0.02,
        unit: 'cash-back-pct',
        matchMcc: [],
        provenance: {
          verified: false,
          todo:
            'TODO: verify against the current Citi terms. The terms page renders via ' +
            'JavaScript and could not be read on August 18, 2026. The card is in the ' +
            'catalog for its structural role: it is the flat rate that wins when no ' +
            'category applies.',
        },
      },
    ],
  },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
