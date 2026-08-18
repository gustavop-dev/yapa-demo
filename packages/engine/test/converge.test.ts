import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { decide } from '../src/converge';
import { FOOD_COURT, MIXED_CLUSTER, TARGET } from './fixtures';

describe('convergencia: preguntar solo cuando la respuesta cambia', () => {
  it('no pregunta nada en un food court, aunque no sepa en cual de los ocho esta', () => {
    const decision = decide(FOOD_COURT, CARDS);

    expect(decision.kind).toBe('converged');
    if (decision.kind !== 'converged') return;

    expect(decision.candidates).toHaveLength(8);
    expect(decision.cardId).toBe('amex-gold');
    // 5812 y 5814 son MCC distintos y caen en la misma regla, asi que la
    // ambiguedad de local no produce ambiguedad de respuesta.
    expect(new Set(FOOD_COURT.map((m) => m.mcc)).size).toBe(2);
  });

  it('agrupa por respuesta y no por comercio cuando si hay que preguntar', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);

    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;

    // Ocho candidatos, dos respuestas posibles: la pregunta es binaria.
    expect(MIXED_CLUSTER).toHaveLength(8);
    expect(decision.groups).toHaveLength(2);

    const total = decision.groups.reduce((n, g) => n + g.merchants.length, 0);
    expect(total).toBe(8);
  });

  it('ordena los grupos por tamano, que es la respuesta mas probable a priori', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);
    if (decision.kind !== 'ambiguous') throw new Error('esperaba ambiguo');

    const sizes = decision.groups.map((g) => g.merchants.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(decision.groups[0]?.cardId).toBe('amex-gold');
  });

  it('trae el porque ya calculado en cada grupo, para no pedir dos viajes', () => {
    const decision = decide(MIXED_CLUSTER, CARDS);
    if (decision.kind !== 'ambiguous') throw new Error('esperaba ambiguo');

    for (const group of decision.groups) {
      expect(group.recommendation.winner.cardId).toBe(group.cardId);
      expect(group.recommendation.mcc.title).toBeTruthy();
    }
  });

  it('converge cuando hay un solo candidato', () => {
    const decision = decide([TARGET], CARDS);
    expect(decision.kind).toBe('converged');
  });
});
