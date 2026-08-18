import { describe, expect, it } from 'vitest';
import { MCC_CATALOG } from '@yapa/engine';
import { CATEGORY_TO_MCC, knownCategories } from '../src/categories';
import { guessMcc } from '../src/mcc-map';

describe('vocabulario de siembra a mano', () => {
  it('mapea toda categoria a un MCC que el catalogo sabe nombrar', () => {
    const huerfanas = Object.entries(CATEGORY_TO_MCC).filter(
      ([, mcc]) => !MCC_CATALOG[mcc],
    );

    // Una categoria que apunta a un MCC sin titulo llega a la UI como
    // "MCC 1234 (sin titulo)", que es peor que no ofrecer la categoria.
    expect(huerfanas).toEqual([]);
  });

  it('usa solo slugs tipeables desde un telefono', () => {
    for (const category of knownCategories()) {
      expect(category).toBe(category.toLowerCase());
      expect(category).not.toContain(' ');
    }
  });

  it('cubre las categorias que un mall tiene seguro', () => {
    for (const needed of [
      'restaurante',
      'comida-rapida',
      'ropa',
      'zapatos',
      'farmacia',
      'supermercado',
      'cine',
      'celulares',
    ]) {
      expect(CATEGORY_TO_MCC[needed]).toBeTruthy();
    }
  });
});

describe('inferencia de MCC desde tags de OpenStreetMap', () => {
  it('produce solo MCC que el catalogo sabe nombrar', () => {
    // Recorre el mismo universo de tags que consulta la query de Overpass.
    const tagPairs: Array<[string, string]> = [
      ['shop', 'supermarket'],
      ['shop', 'department_store'],
      ['shop', 'wholesale'],
      ['shop', 'convenience'],
      ['shop', 'variety_store'],
      ['shop', 'chemist'],
      ['shop', 'clothes'],
      ['shop', 'electronics'],
      ['shop', 'books'],
      ['shop', 'hardware'],
      ['shop', 'doityourself'],
      ['shop', 'bakery'],
      ['shop', 'confectionery'],
      ['shop', 'butcher'],
      ['shop', 'greengrocer'],
      ['amenity', 'restaurant'],
      ['amenity', 'fast_food'],
      ['amenity', 'cafe'],
      ['amenity', 'ice_cream'],
      ['amenity', 'bar'],
      ['amenity', 'pub'],
      ['amenity', 'fuel'],
      ['amenity', 'pharmacy'],
    ];

    for (const [key, value] of tagPairs) {
      const guess = guessMcc({ [key]: value, name: 'Comercio de prueba' });
      expect(guess, `${key}=${value} no mapea`).not.toBeNull();
      expect(MCC_CATALOG[guess!.mcc], `${key}=${value} -> MCC ${guess!.mcc}`).toBeTruthy();
    }
  });

  it('no asume warehouse club por un tag generico de mayorista', () => {
    // "Cereales Futurama" en Duitama esta tagueado shop=wholesale y es un mayorista
    // de granos. La exclusion de warehouse clubs no le corresponde.
    const generico = guessMcc({ shop: 'wholesale', name: 'Cereales Futurama' });
    expect(generico?.mcc).not.toBe('5300');
    expect(generico?.source).toBe('inferred-from-osm');

    const club = guessMcc({ shop: 'wholesale', name: 'Costco' });
    expect(club?.mcc).toBe('5300');
    expect(club?.source).toBe('community');
    expect(club?.brandId).toBe('costco');
  });

  it('conserva la marca cuando el tag manda, para exclusiones por nombre', () => {
    // Una gasolinera de Costco es una gasolinera de verdad y codifica como tal,
    // pero la marca tiene que viajar porque el emisor la excluye por nombre.
    const gas = guessMcc({ amenity: 'fuel', name: 'Costco Gasoline' });

    expect(gas?.mcc).toBe('5541');
    expect(gas?.brandId).toBe('costco');
  });

  it('devuelve null en un tag que no conoce, en vez de adivinar', () => {
    expect(guessMcc({ shop: 'funeral_directors', name: 'X' })).toBeNull();
  });
});
