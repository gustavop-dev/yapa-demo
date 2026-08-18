import { lookupMcc } from './mcc';
import type {
  Card,
  EarnRule,
  Match,
  Merchant,
  Recommendation,
  Rejection,
  RejectionKind,
  RuleMatchKind,
} from './types';

type RuleValue = { valuePerDollar: number; estimated: boolean };

/**
 * Normaliza a dolares por dolar gastado para poder comparar entre monedas.
 * Devuelve null cuando la tarjeta acumula puntos y no tenemos valuacion, porque
 * inventar un numero seria peor que decir que no se puede comparar.
 */
export function ruleValue(card: Card, rule: EarnRule): RuleValue | null {
  if (rule.unit === 'cash-back-pct') {
    return { valuePerDollar: rule.rate, estimated: false };
  }
  if (card.pointValueUsd === null) return null;
  return { valuePerDollar: rule.rate * card.pointValueUsd, estimated: true };
}

function ruleKind(rule: EarnRule): RuleMatchKind {
  if (rule.matchBrandId) return 'brand-promo';
  if (rule.matchMcc.length > 0) return 'mcc';
  return 'base';
}

/** Orden de especificidad: promo de marca gana sobre MCC, y MCC sobre tasa base. */
const KIND_PRIORITY: Record<RuleMatchKind, number> = {
  'brand-promo': 3,
  mcc: 2,
  base: 1,
};

function applies(rule: EarnRule, merchant: Merchant): boolean {
  if (rule.matchBrandId) return rule.matchBrandId === merchant.brandId;
  if (merchant.brandId && rule.excludeBrandId?.includes(merchant.brandId)) {
    return false;
  }
  if (rule.uncertainMcc?.includes(merchant.mcc)) return false;
  if (rule.matchMcc.length === 0) return true;
  return rule.matchMcc.includes(merchant.mcc);
}

function rejectionFor(
  rule: EarnRule,
  merchant: Merchant,
): { kind: RejectionKind; reason: string } {
  const mcc = lookupMcc(merchant.mcc);

  if (merchant.brandId && rule.excludeBrandId?.includes(merchant.brandId)) {
    const quote = rule.provenance.sourceQuote;
    return {
      kind: 'explicitly-excluded',
      reason:
        `${merchant.name} puede codificar como MCC ${mcc.code} (${mcc.title}) y aun ` +
        `asi queda afuera de "${rule.label}": el emisor excluye a esta marca por ` +
        `nombre, no por categoria.` + (quote ? ` Cita: "${quote}"` : ''),
    };
  }

  if (rule.excludeMcc?.includes(merchant.mcc)) {
    const quote = rule.provenance.sourceQuote;
    return {
      kind: 'explicitly-excluded',
      reason:
        `${merchant.name} codifica como MCC ${mcc.code} (${mcc.title}), y el emisor ` +
        `excluye esa categoria de "${rule.label}" por escrito.` +
        (quote ? ` Cita: "${quote}"` : ''),
    };
  }

  if (rule.uncertainMcc?.includes(merchant.mcc)) {
    return {
      kind: 'uncertain-coverage',
      reason:
        `No sabemos si "${rule.label}" cubre el MCC ${mcc.code} (${mcc.title}). ` +
        `La regla esta escrita para ${rule.matchMcc.join(', ')} y este comercio ` +
        `codifica distinto. Verificar con el emisor antes de confiar en esta tasa.`,
    };
  }

  return {
    kind: 'mcc-not-in-rule',
    reason:
      `"${rule.label}" aplica a MCC ${rule.matchMcc.join(', ')}, y ${merchant.name} ` +
      `codifica como ${mcc.code} (${mcc.title}).`,
  };
}

/**
 * Calcula la recomendacion para un comercio concreto.
 *
 * La salida no es una tarjeta: es una tarjeta mas las razones por las que las
 * otras opciones perdieron. Sin ese "porque" esto es un numero, no un producto.
 */
export function recommend(merchant: Merchant, cards: Card[]): Recommendation {
  if (cards.length === 0) {
    throw new Error('recommend() necesita al menos una tarjeta declarada');
  }

  const winners: Match[] = [];
  const unapplied: Array<{ card: Card; rule: EarnRule; value: RuleValue }> = [];

  for (const card of cards) {
    let best: Match | null = null;

    for (const rule of card.rules) {
      const value = ruleValue(card, rule);
      if (value === null) continue;

      if (!applies(rule, merchant)) {
        unapplied.push({ card, rule, value });
        continue;
      }

      const kind = ruleKind(rule);
      const better =
        best === null ||
        KIND_PRIORITY[kind] > KIND_PRIORITY[best.kind] ||
        (KIND_PRIORITY[kind] === KIND_PRIORITY[best.kind] &&
          value.valuePerDollar > best.valuePerDollar);

      if (better) {
        best = {
          cardId: card.id,
          cardName: card.name,
          rule,
          kind,
          valuePerDollar: value.valuePerDollar,
          valueIsEstimated: value.estimated,
        };
      }
    }

    if (best) winners.push(best);
  }

  if (winners.length === 0) {
    throw new Error(
      'Ninguna tarjeta declarada produjo una regla aplicable. Revisa que las ' +
        'tarjetas tengan tasa base o valuacion de puntos.',
    );
  }

  winners.sort((a, b) => b.valuePerDollar - a.valuePerDollar);
  const winner = winners[0]!;

  const rejected: Rejection[] = [];

  // Reglas que habrian ganado pero no aplican. Este es el caso Target.
  for (const { card, rule, value } of unapplied) {
    if (value.valuePerDollar <= winner.valuePerDollar) continue;
    const { kind, reason } = rejectionFor(rule, merchant);
    rejected.push({ cardId: card.id, cardName: card.name, rule, kind, reason });
  }

  // Tarjetas que si aplican pero rinden menos.
  for (const other of winners.slice(1)) {
    rejected.push({
      cardId: other.cardId,
      cardName: other.cardName,
      rule: other.rule,
      kind: 'lower-value',
      reason:
        `"${other.rule.label}" si aplica, pero rinde ${formatValue(other.valuePerDollar)} ` +
        `por dolar contra ${formatValue(winner.valuePerDollar)} de ${winner.cardName}.`,
    });
  }

  return { merchant, mcc: lookupMcc(merchant.mcc), winner, rejected };
}

function formatValue(valuePerDollar: number): string {
  return `${(valuePerDollar * 100).toFixed(2)}%`;
}
