import { describe, expect, it } from 'vitest';
import { resolveSharedCookieDomain } from './cookie-domain.js';

describe('resolveSharedCookieDomain', () => {
  it('returns undefined for same-host local development', () => {
    expect(
      resolveSharedCookieDomain({
        frontendUrls: ['http://localhost:3000'],
        backendUrl: 'http://localhost:4000',
      }),
    ).toBeUndefined();
  });

  it('derives shared parent for sibling production hosts', () => {
    expect(
      resolveSharedCookieDomain({
        frontendUrls: ['https://elpadell.com', 'https://www.elpadell.com'],
        backendUrl: 'https://api.elpadell.com',
      }),
    ).toBe('.elpadell.com');
  });

  it('honors explicit COOKIE_DOMAIN', () => {
    expect(
      resolveSharedCookieDomain({
        cookieDomain: 'elpadell.com',
        frontendUrls: ['https://elpadell.com'],
        backendUrl: 'https://api.elpadell.com',
      }),
    ).toBe('.elpadell.com');
  });

  it('does not invent a cookie domain on a shared hosting suffix', () => {
    expect(
      resolveSharedCookieDomain({
        frontendUrls: ['https://elpadel-web.onrender.com'],
        backendUrl: 'https://elpadel-api.onrender.com',
      }),
    ).toBeUndefined();
  });

  it('rejects an explicit hosting-suffix COOKIE_DOMAIN', () => {
    expect(() =>
      resolveSharedCookieDomain({
        cookieDomain: '.onrender.com',
        frontendUrls: ['https://elpadel-web.onrender.com'],
        backendUrl: 'https://elpadel-api.onrender.com',
      }),
    ).toThrow(/COOKIE_DOMAIN/);
  });

  it('rejects URL-shaped COOKIE_DOMAIN values', () => {
    expect(() =>
      resolveSharedCookieDomain({
        cookieDomain: 'https://elpadell.com',
        frontendUrls: ['https://elpadell.com'],
        backendUrl: 'https://api.elpadell.com',
      }),
    ).toThrow(/COOKIE_DOMAIN/);
  });
});
