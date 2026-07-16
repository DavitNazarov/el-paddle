'use client';

import { Languages } from 'lucide-react';
import { locales, localeNames } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useI18n } from './I18nProvider';

type LanguageSwitcherProps = {
  tone?: 'dark' | 'light';
  className?: string;
};

export function LanguageSwitcher({ tone = 'dark', className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const dark = tone === 'dark';

  return (
    <div
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-full border p-1',
        dark
          ? 'border-[var(--padel-line)] bg-[var(--padel-ink)]/34 text-[var(--padel-ivory)]'
          : 'border-[rgba(88,16,16,0.12)] bg-[var(--padel-ivory)]/70 text-[var(--padel-ink)]',
        className,
      )}
      role="group"
      aria-label={t('common.languageToggle')}
      title={t('common.languageToggle')}
    >
      <Languages className={cn('ml-2 h-4 w-4', dark ? 'text-[var(--padel-gold)]' : 'text-[var(--padel-red)]')} />
      {locales.map((item) => {
        const isActive = locale === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLocale(item)}
            className={cn(
              'min-h-9 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2',
              dark
                ? 'focus-visible:ring-[var(--padel-gold)]'
                : 'focus-visible:ring-[var(--padel-red)]',
              isActive && dark && 'bg-[var(--padel-ivory)] text-[var(--padel-red)]',
              isActive && !dark && 'bg-[var(--padel-red)] text-[var(--padel-ivory)]',
              !isActive && dark && 'text-[var(--padel-muted)] hover:text-[var(--padel-ivory)]',
              !isActive && !dark && 'text-[rgba(88,16,16,0.58)] hover:text-[var(--padel-red)]',
            )}
            title={localeNames[item].label}
          >
            {localeNames[item].short}
          </button>
        );
      })}
    </div>
  );
}
