export const locales = ['ka', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ka';

export const localeNames: Record<Locale, { label: string; short: string }> = {
  ka: { label: 'ქართული', short: 'ქართ' },
  en: { label: 'English', short: 'EN' },
};

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' || value === 'ka' ? value : defaultLocale;
}
