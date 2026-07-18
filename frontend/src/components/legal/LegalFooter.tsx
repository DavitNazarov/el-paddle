'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/shared/I18nProvider';
import { legalBusiness } from '@/lib/legal';

const links = [
  { href: '/legal/privacy', en: 'Privacy', ka: 'კონფიდენციალურობა' },
  { href: '/legal/terms', en: 'Terms', ka: 'პირობები' },
  { href: '/legal/refunds', en: 'Refunds', ka: 'თანხის დაბრუნება' },
  { href: '/legal/cookies', en: 'Cookies', ka: 'Cookie-ები' },
];

export function LegalFooter() {
  const pathname = usePathname();
  const { locale } = useI18n();
  if (pathname === '/') return null;

  return (
    <footer className="border-t border-white/10 bg-[var(--padel-ink)] px-5 py-6 text-[var(--padel-ivory)] sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[rgba(213,201,177,0.55)]">© {new Date().getFullYear()} {legalBusiness.name} · {legalBusiness.email}</p>
        <nav aria-label={locale === 'ka' ? 'იურიდიული დოკუმენტები' : 'Legal documents'} className="flex flex-wrap gap-x-5 gap-y-3">
          {links.map((link) => <Link key={link.href} className="min-h-11 content-center font-semibold underline-offset-4 hover:text-[var(--padel-gold)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]" href={link.href}>{link[locale]}</Link>)}
        </nav>
      </div>
    </footer>
  );
}
