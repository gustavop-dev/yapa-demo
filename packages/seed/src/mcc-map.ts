/**
 * Traduccion de tags de OpenStreetMap a MCC.
 *
 * Todo lo que sale de aca es una INFERENCIA. Ninguna red ni emisor publica el MCC
 * por comercio, y la unica herramienta publica es el Visa Supplier Locator. Un tag
 * de OSM describe que vende el local, no con que codigo lo dio de alta su
 * adquirente, que es lo que realmente decide la recompensa.
 *
 * Por eso todo sale marcado 'inferred-from-osm' y solo los comercios que verifiques
 * a mano suben a 'visa-supplier-locator'.
 */

export type OsmTags = Record<string, string>;

type Rule = {
  key: string;
  value: string;
  mcc: string;
  /** Por que este mapeo, cuando no es obvio. */
  note?: string;
};

const RULES: Rule[] = [
  { key: 'shop', value: 'supermarket', mcc: '5411' },
  { key: 'shop', value: 'department_store', mcc: '5311' },
  {
    key: 'shop',
    value: 'wholesale',
    mcc: '5399',
    // shop=wholesale NO significa warehouse club. En Estados Unidos suele ser
    // Costco o Sam's, pero en Colombia el mismo tag cae sobre mayoristas de granos
    // como "Cereales Futurama". El 5300 solo puede salir de una marca conocida,
    // porque la exclusion de warehouse clubs no aplica a un mayorista de arroz.
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
 * Marcas cuyo MCC es reporte de comunidad, no fuente oficial.
 *
 * Existen porque son justamente los casos que rompen la inferencia por tag: OSM
 * etiqueta a Target como department_store o supermarket segun quien lo mapeo, y
 * ninguna de las dos cosas es lo que decide la recompensa.
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
 * Tags donde el MCC de la marca manda sobre el del tag.
 *
 * Solo aplica a tags de mercaderia general, porque ahi es donde OSM y el MCC
 * discrepan: Target esta mapeado como department_store o supermarket segun quien lo
 * cargo, y ninguna de las dos cosas es lo que decide la recompensa.
 *
 * En cambio una gasolinera de Costco es una gasolinera de verdad y codifica como
 * tal, asi que el tag gana y la marca queda solo como etiqueta. Esa distincion
 * importa: el emisor la excluye por nombre, no por categoria.
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

    // Sub-local de una marca conocida: manda el tag, pero la marca viaja igual
    // porque hay reglas que excluyen por nombre.
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
