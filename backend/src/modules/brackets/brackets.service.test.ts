import { describe, expect, it } from 'vitest';
import { bracketSizeForEntryCount } from './brackets.service.js';

describe('bracket sizing', () => {
  it('uses the smallest supported draw that fits approved entries', () => {
    expect(bracketSizeForEntryCount(2)).toBe(2);
    expect(bracketSizeForEntryCount(3)).toBe(4);
    expect(bracketSizeForEntryCount(5)).toBe(8);
    expect(bracketSizeForEntryCount(9)).toBe(16);
  });

  it('rejects counts that cannot produce a supported bracket', () => {
    expect(() => bracketSizeForEntryCount(1)).toThrow();
    expect(() => bracketSizeForEntryCount(17)).toThrow();
  });
});
