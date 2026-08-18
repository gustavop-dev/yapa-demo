import type { Card } from './types';

/**
 * Catalogo de tarjetas del demo.
 *
 * Regla del proyecto: no se inventan tasas. Cada regla lleva su procedencia.
 * Las que tienen sourceQuote fueron leidas del documento del emisor el 18 de
 * agosto de 2026. Las que tienen todo estan sin verificar y la UI debe mostrarlo.
 *
 * Tres tarjetas alcanzan porque los multiplicadores se pisan entre si, que es lo
 * unico que hace interesante al problema. Cincuenta tarjetas inventadas no
 * demuestran nada.
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
            'TODO: verificar la tasa vigente de restaurantes y su tope contra los ' +
            'terminos de Membership Rewards. Solo se verifico la parte de U.S. supermarkets.',
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
          todo: 'TODO: verificar la tasa base contra los terminos vigentes.',
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
        // La cita dice "warehouse clubs that sell gasoline are not considered gas
        // stations". Una gasolinera de Costco es una gasolinera y codifica como tal,
        // asi que la exclusion tiene que ser por marca y no por MCC.
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
          todo: 'TODO: verificar la tasa base contra el Card Member Agreement vigente.',
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
            'TODO: verificar contra los terminos vigentes de Citi. La pagina de ' +
            'terminos se renderiza por JavaScript y no se pudo leer el 18 de agosto ' +
            'de 2026. La tarjeta esta en el catalogo por su rol estructural: es la ' +
            'tasa plana que gana cuando ninguna categoria aplica.',
        },
      },
    ],
  },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
