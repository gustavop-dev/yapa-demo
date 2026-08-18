import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { decide } from '../src/converge';
import { FOOD_COURT, MIXED_CLUSTER, TARGET } from './fixtures';

describe('convergence: ask only when the answer changes', () => {
  it('asks nothing in a food court, even without knowing which of the eight', () => {
    const decision = decide(FOOD_COURT, CARDS);

    expect(decision.kind).toBe('converged');
    if (decision.kind !== 'converged') return;

    expect(decision.candidates).toHaveLength(8);
    expect(decision.cardId).toBe('amex-gold');
    // 5812 and 5814 are different MCCs that fall under the same rule, so store level
    // ambiguity does not produce answer level ambiguity.
    expect(new Set(FOOD_COURT.map((m) => m.mcc)).size).toBe(2);
  });

  it('groups by answer and not by merchant when asking is unavoidable', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);

    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;

    // Eight candidates, two possible answers: the question is binary.
    expect(MIXED_CLUSTER).toHaveLength(8);
    expect(decision.groups).toHaveLength(2);

    const total = decision.groups.reduce((n, g) => n + g.merchants.length, 0);
    expect(total).toBe(8);
  });

  it('sorts groups by size, which is the most likely answer a priori', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);
    if (decision.kind !== 'ambiguous') throw new Error('expected an ambiguous decision');

    const sizes = decision.groups.map((g) => g.merchants.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(decision.groups[0]?.cardId).toBe('amex-gold');
  });

  it('carries the why already computed in each group, to avoid a second round trip', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);
    if (decision.kind !== 'ambiguous') throw new Error('expected an ambiguous decision');

    for (const group of decision.groups) {
      expect(group.recommendation.winner.cardId).toBe(group.cardId);
      expect(group.recommendation.mcc.title).toBeTruthy();
    }
  });

  it('converges when there is a single candidate', () => {
    const decision = decide([TARGET], CARDS);
    expect(decision.kind).toBe('converged');
  });
});
