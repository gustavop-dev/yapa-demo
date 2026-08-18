import { recommend } from './recommend';
import type { Card, Merchant, Recommendation } from './types';

export type AnswerGroup = {
  cardId: string;
  cardName: string;
  /** Los comercios que llevan a esta misma respuesta. */
  merchants: Merchant[];
  /** Representante del grupo, para poder mostrar el porque sin preguntar todavia. */
  recommendation: Recommendation;
};

export type Decision =
  | {
      kind: 'converged';
      cardId: string;
      recommendation: Recommendation;
      candidates: Merchant[];
    }
  | { kind: 'ambiguous'; groups: AnswerGroup[] };

/**
 * Decide si hace falta preguntarle algo al usuario.
 *
 * El punto no es identificar el comercio: es identificar la tarjeta. Si todos los
 * candidatos cercanos llevan a la misma tarjeta, no hay nada que preguntar aunque
 * no sepamos en cual de los ocho locales del food court esta parado.
 *
 * Y cuando si hay que preguntar, se agrupa por respuesta y no por comercio: ocho
 * candidatos que producen dos respuestas distintas son una pregunta binaria, no
 * una lista de ocho.
 */
export function decide(candidates: Merchant[], cards: Card[]): Decision {
  if (candidates.length === 0) {
    throw new Error('decide() necesita al menos un comercio candidato');
  }

  const byCard = new Map<string, AnswerGroup>();

  for (const merchant of candidates) {
    const recommendation = recommend(merchant, cards);
    const { cardId, cardName } = recommendation.winner;

    const group = byCard.get(cardId);
    if (group) {
      group.merchants.push(merchant);
    } else {
      byCard.set(cardId, {
        cardId,
        cardName,
        merchants: [merchant],
        recommendation,
      });
    }
  }

  const groups = [...byCard.values()];

  if (groups.length === 1) {
    const only = groups[0]!;
    return {
      kind: 'converged',
      cardId: only.cardId,
      recommendation: only.recommendation,
      candidates,
    };
  }

  // El grupo mas grande primero: es la respuesta mas probable a priori.
  groups.sort((a, b) => b.merchants.length - a.merchants.length);
  return { kind: 'ambiguous', groups };
}
