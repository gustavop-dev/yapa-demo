import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/cards';
import { decide } from '../src/converge';
import { PRECISION, resolveNearby } from '../src/geo';
import type { Venue } from '../src/types';

/**
 * Innovo Plaza, Duitama. Centroide y radio calculados sobre la huella real del
 * edificio en OpenStreetMap (way/962050370, poligono de 44 nodos).
 */
const INNOVO: Venue = {
  id: 'innovo-plaza',
  name: 'Innovo Plaza',
  lat: 5.8325762,
  lon: -73.0321686,
  radiusM: 93,
  tenants: [
    { id: 't1', name: 'Puerto Madero', mcc: '5812', mccSource: 'hand-seeded' },
    { id: 't2', name: 'Frutin', mcc: '5451', mccSource: 'hand-seeded' },
    { id: 't3', name: 'Comida rapida A', mcc: '5814', mccSource: 'hand-seeded' },
    { id: 't4', name: 'Ropa B', mcc: '5651', mccSource: 'hand-seeded' },
  ],
};

const INSIDE = { lat: INNOVO.lat, lon: INNOVO.lon };

describe('adentro de un mall la ubicacion resuelve el edificio, no el local', () => {
  it('devuelve todos los locales como candidatos, sin recortar por distancia', () => {
    const result = resolveNearby(INSIDE, 25, [], [INNOVO]);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.venue?.name).toBe('Innovo Plaza');
    expect(result.candidates).toHaveLength(INNOVO.tenants.length);
    // Recortar por distancia adentro del edificio seria descartar candidatos por
    // un criterio que no existe: todos estan a la misma distancia efectiva.
    expect(new Set(result.candidates.map((c) => c.distanceM))).toEqual(new Set([0]));
  });

  it('se dispara cuando el circulo de incertidumbre solapa el edificio', () => {
    // A 150 m del centroide, con un fix de 80 m, el usuario puede estar adentro:
    // 150 <= 93 + 80. Exigir que el punto caiga dentro de la huella seria tratar
    // la coordenada como exacta.
    const nearby = { lat: INNOVO.lat + 150 / 111_320, lon: INNOVO.lon };

    const loose = resolveNearby(nearby, 80, [], [INNOVO]);
    expect(loose.status).toBe('ok');
    if (loose.status === 'ok') expect(loose.venue?.id).toBe('innovo-plaza');

    // Con un fix bueno, ese mismo punto ya esta claramente afuera.
    const tight = resolveNearby(nearby, 10, [], [INNOVO]);
    expect(tight.status).toBe('no-candidates');
  });

  it('sigue rechazando el fix cuando la precision no alcanza', () => {
    const result = resolveNearby(INSIDE, PRECISION.unusableAccuracyM + 1, [], [
      INNOVO,
    ]);
    expect(result.status).toBe('accuracy-too-low');
  });

  it('ignora venues sin locales sembrados todavia', () => {
    const vacio: Venue = { ...INNOVO, tenants: [] };
    const result = resolveNearby(INSIDE, 25, [], [vacio]);
    expect(result.status).toBe('no-candidates');
  });

  it('deja que la convergencia haga la desambiguacion que el GPS no puede', () => {
    const result = resolveNearby(INSIDE, 25, [], [INNOVO]);
    if (result.status !== 'ok') throw new Error('esperaba ok');

    const decision = decide(result.candidates, CARDS);

    // Cuatro locales con MCC de comida y de ropa no convergen, asi que hay que
    // preguntar. Pero la pregunta se agrupa por respuesta, no por local.
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;
    expect(decision.groups.length).toBeLessThan(INNOVO.tenants.length);
  });

  it('no pregunta nada si todos los locales del venue comparten respuesta', () => {
    const foodOnly: Venue = {
      ...INNOVO,
      tenants: INNOVO.tenants.filter((t) => t.mcc === '5812' || t.mcc === '5814'),
    };

    const result = resolveNearby(INSIDE, 25, [], [foodOnly]);
    if (result.status !== 'ok') throw new Error('esperaba ok');

    expect(decide(result.candidates, CARDS).kind).toBe('converged');
  });
});
