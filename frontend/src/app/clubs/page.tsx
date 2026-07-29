import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicClubsDirectory, type PublicClub } from '@/components/tournament/PublicDirectoryClients';
import { apiUrl } from '@/lib/api';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.clubs;
  return buildPageMetadata({
    title: `${copy.title} — El Padel`,
    description: copy.description,
    path: '/clubs',
  });
}

async function getClubs() {
  const response = await fetch(apiUrl('/api/public/clubs'), { next: { revalidate: 120 } });
  if (!response.ok) throw new Error('Could not load clubs.');
  const data = (await response.json()) as { clubs?: PublicClub[] };
  return data.clubs ?? [];
}

export default async function ClubsPage() {
  return <PublicClubsDirectory clubs={await getClubs()} />;
}
