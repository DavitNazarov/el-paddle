'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultLocale, dictionaries, normalizeLocale, type Locale } from '@/lib/i18n';

const localeCookieName = 'elpadel_locale';
const localeStorageKey = 'elpadel_locale';

type Dictionary = (typeof dictionaries)[Locale];
type Replacements = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  t: (path: string, replacements?: Replacements) => string;
  formatDate: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function interpolate(value: string, replacements: Replacements = {}) {
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    const replacement = replacements[key];
    return replacement === undefined ? match : String(replacement);
  });
}

function preferredBrowserLocale() {
  if (typeof navigator === 'undefined') return defaultLocale;
  return navigator.language.toLowerCase().startsWith('ka') ? 'ka' : 'en';
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initialLocale));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLocale = params.get('lang');
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    const nextLocale = normalizeLocale(
      requestedLocale ?? storedLocale ?? document.documentElement.lang ?? preferredBrowserLocale(),
    );
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(localeStorageKey, locale);
    document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  const t = useCallback(
    (path: string, replacements?: Replacements) => {
      const value =
        readPath(dictionaries[locale], path) ??
        readPath(dictionaries[defaultLocale], path) ??
        path;

      return interpolate(String(value), replacements);
    },
    [locale],
  );

  const formatDate = useCallback(
    (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale === 'ka' ? 'ka-GE' : 'en', options).format(new Date(value)),
    [locale],
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      dictionary: dictionaries[locale],
      setLocale,
      t,
      formatDate,
    }),
    [formatDate, locale, setLocale, t],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
