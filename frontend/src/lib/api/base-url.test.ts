import { describe, expect, it } from 'vitest';
import {
  LOCAL_DEV_API_ORIGIN,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from './base-url';

describe('normalizeApiBaseUrl', () => {
  it('returns null for empty or non-http values', () => {
    expect(normalizeApiBaseUrl(undefined)).toBeNull();
    expect(normalizeApiBaseUrl('')).toBeNull();
    expect(normalizeApiBaseUrl('  ')).toBeNull();
    expect(normalizeApiBaseUrl('postgresql://db/elpadel')).toBeNull();
    expect(normalizeApiBaseUrl('api-pi.elpadell.com')).toBeNull();
  });

  it('strips trailing slashes and a mistaken /api suffix', () => {
    expect(normalizeApiBaseUrl('https://api-pi.elpadell.com')).toBe('https://api-pi.elpadell.com');
    expect(normalizeApiBaseUrl('https://api-pi.elpadell.com/')).toBe('https://api-pi.elpadell.com');
    expect(normalizeApiBaseUrl('https://api-pi.elpadell.com/api')).toBe('https://api-pi.elpadell.com');
    expect(normalizeApiBaseUrl('https://api-pi.elpadell.com/api/')).toBe('https://api-pi.elpadell.com');
    expect(normalizeApiBaseUrl('http://localhost:4000/api')).toBe('http://localhost:4000');
  });
});

describe('resolveApiBaseUrl', () => {
  it('falls back to localhost outside production when unset', () => {
    expect(resolveApiBaseUrl(undefined, { nodeEnv: 'development' })).toBe(LOCAL_DEV_API_ORIGIN);
    expect(resolveApiBaseUrl('', { nodeEnv: 'test' })).toBe(LOCAL_DEV_API_ORIGIN);
  });

  it('returns the normalized origin when configured', () => {
    expect(resolveApiBaseUrl('https://api-pi.elpadell.com/api', { nodeEnv: 'production' }))
      .toBe('https://api-pi.elpadell.com');
  });

  it('throws in production when the env is missing or invalid', () => {
    expect(() => resolveApiBaseUrl(undefined, { nodeEnv: 'production' })).toThrow(/NEXT_PUBLIC_API_URL/);
    expect(() => resolveApiBaseUrl('not-a-url', { nodeEnv: 'production' })).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
