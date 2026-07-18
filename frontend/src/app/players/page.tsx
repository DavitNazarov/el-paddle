import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicPlayersDirectory, type PublicPlayer } from '@/components/tournament/PublicDirectoryClients';
import { apiUrl } from '@/lib/api';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.players;
  return { title: `${copy.title} — El Padel`, description: copy.description };
}

async function getPlayers() {
  const response = await fetch(apiUrl('/api/public/players'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load players.');
  const data = (await response.json()) as { players?: PublicPlayer[] };
  return data.players ?? [];
}

export default async function PlayersPage() {
  return <PublicPlayersDirectory players={await getPlayers()} />;
}
