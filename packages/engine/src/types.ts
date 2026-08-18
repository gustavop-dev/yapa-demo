/**
 * Un MCC (Merchant Category Code) es un codigo de 4 digitos del estandar ISO 18245.
 * Los titulos que usamos son los del Visa Merchant Data Standards Manual, abril 2026.
 */
export type Mcc = {
  code: string;
  title: string;
  /** Detalle del manual de Visa que importa para decidir, si lo hay. */
  note?: string;
};

/**
 * De donde salio el MCC de un comercio concreto.
 *
 * Ninguna red ni emisor publica el MCC por comercio. La unica herramienta publica
 * es el Visa Supplier Locator. Todo lo demas es inferencia o reporte de comunidad,
 * y el usuario tiene derecho a verlo.
 */
export type MccSource =
  | 'visa-supplier-locator'
  | 'community'
  | 'inferred-from-osm'
  | 'hand-seeded';

/**
 * Un comercio sin ubicacion propia.
 *
 * Existe porque adentro de un centro comercial la coordenada individual es una
 * ficcion: el error horizontal supera la distancia entre locales, asi que darle
 * lat/lon a cada tienda seria declarar una precision que no tenemos. Los locales
 * de un venue son tenants, no comercios ubicados.
 */
export type MerchantCore = {
  id: string;
  name: string;
  mcc: string;
  mccSource: MccSource;
  /** Marca estable, para promos y exclusiones merchant-especificas. */
  brandId?: string;
};

export type Merchant = MerchantCore & {
  lat: number;
  lon: number;
};

/**
 * Un contenedor con locales adentro: mall, food court, aeropuerto.
 *
 * El GPS resuelve el edificio y no el local. Por eso el venue tiene una sola
 * coordenada y todos sus tenants entran juntos como candidatos: la desambiguacion
 * la hace la convergencia de respuestas, no la geometria.
 */
export type Venue = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Radio aproximado de la huella del edificio. */
  radiusM: number;
  tenants: MerchantCore[];
};

export type Coords = { lat: number; lon: number };

export type MerchantCandidate = Merchant & { distanceM: number };

/**
 * La unidad importa: 4 puntos por dolar y 4% cash back no son lo mismo.
 * Comparar entre monedas exige una valuacion del punto, que es una estimacion
 * nuestra y no un dato del emisor.
 */
export type EarnUnit = 'cash-back-pct' | 'points-per-dollar';

export type Cap = {
  amountUsd: number;
  period: 'calendar-year' | 'quarter' | 'month';
};

/**
 * Procedencia de una tasa. El catalogo de earn rates es el activo riesgoso del
 * negocio: nadie lo publica completo y cambia cuando el emisor quiere. Una tasa
 * sin fuente citada se muestra como no verificada, nunca se presenta como cierta.
 */
export type Provenance = {
  verified: boolean;
  sourceUrl?: string;
  sourceQuote?: string;
  /** Fecha declarada por el propio documento del emisor. */
  sourceDate?: string;
  todo?: string;
};

export type EarnRule = {
  id: string;
  /** Nombre de la categoria tal como la llama el emisor. */
  label: string;
  rate: number;
  unit: EarnUnit;
  /** MCCs que la regla acepta. Vacio significa que aplica a todo (tasa base). */
  matchMcc: string[];
  /**
   * MCCs que el emisor nombra explicitamente como excluidos.
   *
   * No cambia el resultado (si no esta en matchMcc, no aplica igual), pero si
   * cambia la explicacion: "no calificaste" y "el emisor te excluye por escrito"
   * son cosas distintas para el usuario.
   */
  excludeMcc?: string[];
  /**
   * MCCs sobre los que no sabemos si la regla aplica.
   *
   * Existe porque el caso 5541 contra 5542 es real: los terminos dicen "gasoline
   * stations" y el surtidor desatendido es otro MCC. Adivinar seria peor que
   * decir que no sabemos, asi que el motor lo reporta como incertidumbre.
   */
  uncertainMcc?: string[];
  /**
   * Marcas que el emisor excluye por nombre, sin importar el MCC.
   *
   * Hace falta porque hay exclusiones que no son categoriales. Blue Cash Preferred
   * dice "warehouse clubs that sell gasoline are not considered gas stations": una
   * gasolinera de Costco es una gasolinera de verdad y probablemente codifique como
   * tal, y aun asi queda afuera por ser de un club mayorista.
   */
  excludeBrandId?: string[];
  /** Promo atada a una marca concreta. Gana sobre cualquier regla por MCC. */
  matchBrandId?: string;
  cap?: Cap;
  provenance: Provenance;
};

export type Card = {
  id: string;
  issuer: string;
  name: string;
  currency: 'usd-cashback' | 'membership-rewards' | 'ultimate-rewards';
  /**
   * Valor asumido del punto en dolares, para poder comparar tarjetas de monedas
   * distintas. NO es un dato del emisor: es una estimacion nuestra y la UI debe
   * mostrarla como tal. null significa que no podemos comparar.
   */
  pointValueUsd: number | null;
  pointValueNote: string;
  rules: EarnRule[];
};

export type RuleMatchKind = 'brand-promo' | 'mcc' | 'base';

export type Match = {
  cardId: string;
  cardName: string;
  rule: EarnRule;
  kind: RuleMatchKind;
  /** Dolares ganados por dolar gastado, ya normalizado entre monedas. */
  valuePerDollar: number;
  /** true si valuePerDollar depende de una valuacion de puntos estimada. */
  valueIsEstimated: boolean;
};

export type RejectionKind =
  | 'explicitly-excluded'
  | 'uncertain-coverage'
  | 'mcc-not-in-rule'
  | 'lower-value';

export type Rejection = {
  cardId: string;
  cardName: string;
  rule: EarnRule;
  kind: RejectionKind;
  reason: string;
};

export type Recommendation = {
  merchant: Merchant;
  mcc: Mcc;
  winner: Match;
  /** El corazon del demo: por que las otras opciones perdieron. */
  rejected: Rejection[];
};
