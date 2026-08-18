import { describe, expect, it } from 'vitest';
import { MCC_CATALOG } from '@yapa/engine';
import { CATEGORY_TO_MCC, knownCategories } from '../src/categories';
import { guessMcc } from '../src/mcc-map';

describe('hand seeding vocabulary', () => {
  it('maps every category to an MCC the catalog can name', () => {
    const orphans = Object.entries(CATEGORY_TO_MCC).filter(
      ([, mcc]) => !MCC_CATALOG[mcc],
    );

    // A category pointing at an MCC with no title reaches the UI as
    // "MCC 1234 (sin titulo)", which is worse than not offering the category.
    expect(orphans).toEqual([]);
  });

  it('uses only slugs that are typable from a phone', () => {
    for (const category of knownCategories()) {
      expect(category).toBe(category.toLowerCase());
      expect(category).not.toContain(' ');
    }
  });

  it('covers the categories a mall is guaranteed to have', () => {
    // The slugs stay in Spanish: they are typed by hand while seeding in Duitama.
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

describe('MCC inference from OpenStreetMap tags', () => {
  it('produces only MCCs the catalog can name', () => {
    // Walks the same universe of tags the Overpass query asks for.
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
      const guess = guessMcc({ [key]: value, name: 'Test merchant' });
      expect(guess, `${key}=${value} does not map`).not.toBeNull();
      expect(MCC_CATALOG[guess!.mcc], `${key}=${value} -> MCC ${guess!.mcc}`).toBeTruthy();
    }
  });

  it('does not assume warehouse club from a generic wholesale tag', () => {
    // "Cereales Futurama" in Duitama is tagged shop=wholesale and is a grain
    // wholesaler. The warehouse club exclusion does not apply to it.
    const generic = guessMcc({ shop: 'wholesale', name: 'Cereales Futurama' });
    expect(generic?.mcc).not.toBe('5300');
    expect(generic?.source).toBe('inferred-from-osm');

    const club = guessMcc({ shop: 'wholesale', name: 'Costco' });
    expect(club?.mcc).toBe('5300');
    expect(club?.source).toBe('community');
    expect(club?.brandId).toBe('costco');
  });

  it('keeps the brand when the tag carries it, for name based exclusions', () => {
    // A Costco gas station is a real gas station and codes as one, but the brand has
    // to travel because the issuer excludes it by name.
    const gas = guessMcc({ amenity: 'fuel', name: 'Costco Gasoline' });

    expect(gas?.mcc).toBe('5541');
    expect(gas?.brandId).toBe('costco');
  });

  it('returns null on an unknown tag instead of guessing', () => {
    expect(guessMcc({ shop: 'funeral_directors', name: 'X' })).toBeNull();
  });
});
