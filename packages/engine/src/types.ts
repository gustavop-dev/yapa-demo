/**
 * An MCC (Merchant Category Code) is a 4 digit code from the ISO 18245 standard.
 * The titles we use are the ones in the Visa Merchant Data Standards Manual, April 2026.
 */
export type Mcc = {
  code: string;
  title: string;
  /** Detail from the Visa manual that matters when deciding, if there is one. */
  note?: string;
};

/**
 * Where the MCC of a given merchant came from.
 *
 * No network or issuer publishes MCC per merchant. The only public tool is the Visa
 * Supplier Locator. Everything else is inference or community reporting, and the user
 * has a right to see which one it is.
 */
export type MccSource =
  | 'visa-supplier-locator'
  | 'community'
  | 'inferred-from-osm'
  | 'hand-seeded';

/**
 * A merchant with no location of its own.
 *
 * It exists because inside a mall an individual coordinate is fiction: the horizontal
 * error is larger than the distance between stores, so giving each store its own
 * lat/lon would declare a precision we do not have. Stores inside a venue are tenants,
 * not located merchants.
 */
export type MerchantCore = {
  id: string;
  name: string;
  mcc: string;
  mccSource: MccSource;
  /** Stable brand, for merchant specific promos and exclusions. */
  brandId?: string;
};

export type Merchant = MerchantCore & {
  lat: number;
  lon: number;
};

/**
 * A container with stores inside: mall, food court, airport.
 *
 * GPS resolves the building, not the store. That is why a venue has a single
 * coordinate and all of its tenants enter together as candidates: disambiguation comes
 * from convergence of answers, not from geometry.
 */
export type Venue = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Approximate radius of the building footprint. */
  radiusM: number;
  tenants: MerchantCore[];
};

export type Coords = { lat: number; lon: number };

export type MerchantCandidate = Merchant & { distanceM: number };

/**
 * The unit matters: 4 points per dollar and 4% cash back are not the same thing.
 * Comparing across currencies requires a point valuation, which is an estimate of ours
 * and not a figure published by the issuer.
 */
export type EarnUnit = 'cash-back-pct' | 'points-per-dollar';

export type Cap = {
  amountUsd: number;
  period: 'calendar-year' | 'quarter' | 'month';
};

/**
 * Provenance of a rate. The earn rate catalog is the risky asset of this business:
 * nobody publishes it in full and it changes whenever the issuer wants. A rate with no
 * cited source is shown as unverified, never presented as certain.
 */
export type Provenance = {
  verified: boolean;
  sourceUrl?: string;
  sourceQuote?: string;
  /** Date declared by the issuer document itself. */
  sourceDate?: string;
  todo?: string;
};

export type EarnRule = {
  id: string;
  /** Category name as the issuer calls it. */
  label: string;
  rate: number;
  unit: EarnUnit;
  /** MCCs the rule accepts. Empty means it applies to everything (base rate). */
  matchMcc: string[];
  /**
   * MCCs the issuer names explicitly as excluded.
   *
   * It does not change the result (if it is not in matchMcc the rule does not apply
   * either way), but it does change the explanation: "you did not qualify" and "the
   * issuer excludes you in writing" are different things for the user.
   */
  excludeMcc?: string[];
  /**
   * MCCs where we do not know whether the rule applies.
   *
   * It exists because the 5541 versus 5542 case is real: the terms say "gasoline
   * stations" and the unattended pump is a different MCC. Guessing would be worse than
   * saying we do not know, so the engine reports it as uncertainty.
   */
  uncertainMcc?: string[];
  /**
   * Brands the issuer excludes by name, regardless of MCC.
   *
   * Needed because some exclusions are not categorical. Blue Cash Preferred says
   * "warehouse clubs that sell gasoline are not considered gas stations": a Costco gas
   * station is a real gas station and probably codes as one, and it is still left out
   * for belonging to a warehouse club.
   */
  excludeBrandId?: string[];
  /** Promo tied to a specific brand. Wins over any MCC based rule. */
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
   * Assumed point value in dollars, so cards in different currencies can be compared.
   * This is NOT issuer data: it is an estimate of ours and the UI has to show it as
   * such. null means we cannot compare.
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
  /** Dollars earned per dollar spent, already normalized across currencies. */
  valuePerDollar: number;
  /** true if valuePerDollar depends on an estimated point valuation. */
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
  /** The heart of the demo: why the other options lost. */
  rejected: Rejection[];
};
