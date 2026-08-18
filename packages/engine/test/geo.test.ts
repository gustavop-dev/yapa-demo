import { describe, expect, it } from 'vitest';
import {
  PRECISION,
  candidateRadiusM,
  haversineM,
  resolveNearby,
} from '../src/geo';
import { geohash, buildConfirmation } from '../src/privacy';
import { FOOD_COURT, ORIGIN, TARGET } from './fixtures';

describe('la ubicacion es un filtro de candidatos, no una respuesta', () => {
  it('rechaza el fix cuando el error horizontal supera el umbral util', () => {
    // El modo aproximado de Android da unos 3 kilometros cuadrados. Con ese error
    // la lista de candidatos aparentaria una precision que no tenemos.
    const result = resolveNearby(ORIGIN, 1500, [TARGET, ...FOOD_COURT]);

    expect(result.status).toBe('accuracy-too-low');
    if (result.status !== 'accuracy-too-low') return;
    expect(result.thresholdM).toBe(PRECISION.unusableAccuracyM);
  });

  it('agranda el radio de busqueda cuando el fix es peor', () => {
    expect(candidateRadiusM(5)).toBe(PRECISION.minRadiusM);
    expect(candidateRadiusM(100)).toBe(200);
    expect(candidateRadiusM(450)).toBe(PRECISION.maxRadiusM);
  });

  it('devuelve candidatos ordenados por distancia', () => {
    const result = resolveNearby(ORIGIN, 20, [TARGET, ...FOOD_COURT]);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const distances = result.candidates.map((c) => c.distanceM);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('distingue no encontrar nada de no poder ubicar', () => {
    const faraway = { lat: 40.7128, lon: -74.006 };
    const result = resolveNearby(faraway, 20, [TARGET]);
    expect(result.status).toBe('no-candidates');
  });

  it('mide distancias en metros con sentido', () => {
    const oneDegreeNorth = { lat: ORIGIN.lat + 1, lon: ORIGIN.lon };
    expect(haversineM(ORIGIN, oneDegreeNorth)).toBeGreaterThan(110_000);
    expect(haversineM(ORIGIN, oneDegreeNorth)).toBeLessThan(112_000);
  });
});

describe('lo que se persiste despues de confirmar', () => {
  it('guarda geohash de nivel 6, que queda fuera de la definicion de Maryland', () => {
    const confirmation = buildConfirmation(
      TARGET.id,
      TARGET,
      new Date('2026-08-18T14:30:00'),
    );

    expect(confirmation.geohash6).toHaveLength(6);
    expect(confirmation.merchantId).toBe(TARGET.id);
    expect(confirmation.hourBucket).toBe(14);
  });

  it('no incluye coordenadas crudas en ningun campo', () => {
    const confirmation = buildConfirmation(TARGET.id, TARGET, new Date());
    const keys = Object.keys(confirmation);

    expect(keys).toEqual(['merchantId', 'geohash6', 'hourBucket']);
    expect(JSON.stringify(confirmation)).not.toContain(String(TARGET.lat));
    expect(JSON.stringify(confirmation)).not.toContain(String(TARGET.lon));
  });

  it('codifica geohash contra valores de referencia conocidos', () => {
    // Ejemplo canonico de la especificacion: ezs42 decodifica a (42.6, -5.6).
    expect(geohash({ lat: 42.6, lon: -5.6 }, 5)).toBe('ezs42');
    expect(geohash({ lat: 51.5074, lon: -0.1278 }, 6)).toBe('gcpvj0');
    expect(geohash({ lat: 48.8583, lon: 2.2945 }, 6)).toBe('u09tun');
  });

  it('mete en la misma celda de nivel 6 a comercios de la misma cuadra', () => {
    const a = geohash(TARGET, 6);
    const b = geohash(FOOD_COURT[0]!, 6);
    expect(a).toBe(b);
  });
});
