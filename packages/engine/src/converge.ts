import { recommend } from './recommend';
import type { Card, Merchant, Recommendation } from './types';

export type AnswerGroup = {
  cardId: string;
  cardName: string;
  /** The merchants that lead to this same answer. */
  merchants: Merchant[];
  /** Group representative, so the why can be shown before asking anything. */
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
 * Decides whether the user has to be asked anything at all.
 *
 * The point is not to identify the merchant: it is to identify the card. If every
 * nearby candidate leads to the same card there is nothing to ask, even if we do not
 * know which of the eight food court stores the user is standing in.
 *
 * And when asking is unavoidable, candidates are grouped by answer and not by
 * merchant: eight candidates that produce two distinct answers are a binary question,
 * not a list of eight.
 */
export function decide(candidates: Merchant[], cards: Card[]): Decision {
  if (candidates.length === 0) {
    throw new Error('decide() needs at least one candidate merchant');
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

  // Largest group first: it is the most likely answer a priori.
  groups.sort((a, b) => b.merchants.length - a.merchants.length);
  return { kind: 'ambiguous', groups };
}
