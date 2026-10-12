import { describe, expect, it } from 'vitest';
import { tournamentCopy } from './tournament';
import { en } from './en';
import { ka } from './ka';

/**
 * The two locales have to hold the same keys.
 *
 * Nothing else enforces it: `tournamentCopy` is declared `satisfies
 * Record<Locale, object>`, which checks that both locales exist and says
 * nothing about their shape. A key added to one and forgotten in the other is
 * therefore a clean compile and an `undefined` rendered into the interface,
 * which is exactly the failure a copy change is most likely to introduce.
 */

/** Every leaf path in an object, so two locales can be compared as sets. */
function paths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key));
}

function compare(english: unknown, georgian: unknown) {
  const left = paths(english);
  const right = paths(georgian);
  return {
    missingFromGeorgian: left.filter((key) => !right.includes(key)),
    missingFromEnglish: right.filter((key) => !left.includes(key)),
  };
}

describe('the two locales stay in step', () => {
  it('tournamentCopy holds the same keys in English and Georgian', () => {
    expect(compare(tournamentCopy.en, tournamentCopy.ka)).toEqual({
      missingFromGeorgian: [],
      missingFromEnglish: [],
    });
  });

  it('the dictionaries hold the same keys in English and Georgian', () => {
    expect(compare(en, ka)).toEqual({ missingFromGeorgian: [], missingFromEnglish: [] });
  });
});
