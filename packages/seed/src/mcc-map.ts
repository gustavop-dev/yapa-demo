/**
 * Translation from OpenStreetMap tags to MCC.
 *
 * Everything coming out of here is an INFERENCE. No network or issuer publishes MCC
 * per merchant, and the only public tool is the Visa Supplier Locator. An OSM tag
 * describes what the store sells, not the code its acquirer registered it under, which
 * is what actually decides the reward.
 *
 * That is why everything comes out marked 'inferred-from-osm' and only merchants
 * verified by hand are promoted to 'visa-supplier-locator'.
 *
 * The note strings stay in Spanish: they are copied verbatim into the generated seed
 * files under data/, so translating them here would silently drift from the data
 * already committed.
 */

export type OsmTags = Record<string, string>;

type Rule = {
  key: string;
  value: string;
  mcc: string;
  /** Why this mapping, when it is not obvious. */
  note?: string;
};

const RULES: Rule[] = [
  { key: 'shop', value: 'supermarket', mcc: '5411' },
  { key: 'shop', value: 'department_store', mcc: '5311' },
  {
    key: 'shop',
    value: 'wholesale',
    mcc: '5399',
    // shop=wholesale does NOT mean warehouse club. In the US it is usually Costco or
    // Sam's, but in Colombia the same tag lands on grain wholesalers like "Cereales
    // Futurama". 5300 can only come from a known brand, because the warehouse club
    // exclusion does not apply to a rice wholesaler.
    note: 'shop=wholesale generico. No se asume warehouse club: eso exige marca conocida.',
  },
  {
    key: 'shop',
    value: 'convenience',
    mcc: '5499',
    note: 'Amex nombra explicitamente a las convenience stores como excluidas de supermercados.',
  },
  { key: 'shop', value: 'chemist', mcc: '5912' },
  { key: 'shop', value: 'clothes', mcc: '5651' },
  { key: 'shop', value: 'electronics', mcc: '5732' },
  { key: 'shop', value: 'books', mcc: '5942' },
  { key: 'shop', value: 'hardware', mcc: '5251' },
  { key: 'shop', value: 'doityourself', mcc: '5200' },
  { key: 'shop', value: 'variety_store', mcc: '5331' },
  { key: 'shop', value: 'bakery', mcc: '5462' },
  { key: 'shop', value: 'confectionery', mcc: '5441' },
  { key: 'shop', value: 'butcher', mcc: '5422' },
  {
    key: 'shop',
    value: 'greengrocer',
    mcc: '5499',
    note: 'El manual de Visa lista Fruit Markets dentro de 5499.',
  },
  {
    key: 'amenity',
    value: 'ice_cream',
    mcc: '5451',
    note: 'El manual de Visa incluye ice cream dentro de Dairy Products Stores.',
  },
  {
    key: 'amenity',
    value: 'bar',
    mcc: '5813',
    note: 'Los bares tienen categoria propia, separada de restaurantes.',
  },
  { key: 'amenity', value: 'pub', mcc: '5813' },
  { key: 'amenity', value: 'restaurant', mcc: '5812' },
  { key: 'amenity', value: 'fast_food', mcc: '5814' },
  {
    key: 'amenity',
    value: 'cafe',
    mcc: '5814',
    note: 'Mastercard lista coffee shops dentro de 5814. Visa podria ubicarlo en 5812.',
  },
  { key: 'amenity', value: 'fuel', mcc: '5541' },
  { key: 'amenity', value: 'pharmacy', mcc: '5912' },
];

/**
 * Brands whose MCC is community reported, not an official source.
 *
 * They exist because these are exactly the cases that break tag inference: OSM tags
 * Target as department_store or supermarket depending on who mapped it, and neither of
 * those is what decides the reward.
 */
const BRAND_OVERRIDES: Array<{
  match: RegExp;
  brandId: string;
  mcc: string;
  note: string;
}> = [
  {
    match: /^target\b/i,
    brandId: 'target',
    mcc: '5310',
    note: 'Reporte de comunidad. Amex lo nombra como superstore excluido de supermercados.',
  },
  {
    match: /^walmart\b/i,
    brandId: 'walmart',
    mcc: '5310',
    note: 'Reporte de comunidad. Amex y Chase lo nombran como superstore excluido.',
  },
  {
    match: /^costco\b/i,
    brandId: 'costco',
    mcc: '5300',
    note: 'Reporte de comunidad. Warehouse club, excluido de supermercados.',
  },
  {
    match: /^sam'?s club\b/i,
    brandId: 'sams-club',
    mcc: '5300',
    note: 'Reporte de comunidad. Warehouse club.',
  },
  {
    match: /^bj'?s\b/i,
    brandId: 'bjs',
    mcc: '5300',
    note: 'Reporte de comunidad. Amex lo nombra como warehouse club excluido.',
  },
  {
    match: /^pricesmart\b/i,
    brandId: 'pricesmart',
    mcc: '5300',
    note: 'Warehouse club, el equivalente de Costco en varios paises de LatAm.',
  },
  {
    match: /^makro\b/i,
    brandId: 'makro',
    mcc: '5300',
    note: 'Warehouse club presente en LatAm.',
  },
];

/**
 * Tags where the brand MCC wins over the tag MCC.
 *
 * This only applies to general merchandise tags, because that is where OSM and MCC
 * disagree: Target is mapped as department_store or supermarket depending on who
 * entered it, and neither is what decides the reward.
 *
 * A Costco gas station, on the other hand, is a real gas station and codes as one, so
 * the tag wins and the brand stays only as a label. That distinction matters: the
 * issuer excludes it by name, not by category.
 */
const GENERAL_MERCHANDISE_TAGS = new Set([
  'shop=department_store',
  'shop=supermarket',
  'shop=wholesale',
  'shop=general',
  'shop=variety_store',
]);

export type MccGuess = {
  mcc: string;
  source: 'inferred-from-osm' | 'community';
  brandId?: string;
  note?: string;
};

function tagMcc(tags: OsmTags): { mcc: string; note?: string; tag: string } | null {
  for (const rule of RULES) {
    if (tags[rule.key] === rule.value) {
      return rule.note
        ? { mcc: rule.mcc, note: rule.note, tag: `${rule.key}=${rule.value}` }
        : { mcc: rule.mcc, tag: `${rule.key}=${rule.value}` };
    }
  }
  return null;
}

export function guessMcc(tags: OsmTags): MccGuess | null {
  const name = tags['name'];
  const fromTag = tagMcc(tags);

  const brand = name
    ? BRAND_OVERRIDES.find((b) => b.match.test(name))
    : undefined;

  if (brand) {
    const brandMccWins =
      fromTag === null || GENERAL_MERCHANDISE_TAGS.has(fromTag.tag);

    if (brandMccWins) {
      return {
        mcc: brand.mcc,
        source: 'community',
        brandId: brand.brandId,
        note: brand.note,
      };
    }

    // Sub location of a known brand: the tag wins, but the brand travels anyway
    // because some rules exclude by name.
    return {
      mcc: fromTag.mcc,
      source: 'inferred-from-osm',
      brandId: brand.brandId,
      note:
        `Tag de OSM (${fromTag.tag}) sobre una marca conocida. La marca se conserva ` +
        `porque hay reglas de tarjeta que excluyen por nombre y no por MCC.`,
    };
  }

  if (!fromTag) return null;

  return fromTag.note
    ? { mcc: fromTag.mcc, source: 'inferred-from-osm', note: fromTag.note }
    : { mcc: fromTag.mcc, source: 'inferred-from-osm' };
}
