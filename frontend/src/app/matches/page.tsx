import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicMatchesPageClient } from '@/components/tournament/PublicDirectoryClients';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.matches;
  return buildPageMetadata({
    title: `${copy.title} — El Padel`,
    description: copy.description,
    path: '/matches',
  });
}

export default function MatchesPage() {
  return <PublicMatchesPageClient />;
}
