import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { PublicPlayerProfile, type PublicPlayer } from '@/components/tournament/PublicDirectoryClients';
import { apiUrl } from '@/lib/api';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';

type PlayerProfilePageProps = { params: Promise<{ playerId: string }> };

async function getPlayer(playerId: string) {
  const response = await fetch(apiUrl(`/api/public/players/${encodeURIComponent(playerId)}`), { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load player profile.');
  return ((await response.json()) as { player: PublicPlayer }).player;
}

export async function generateMetadata({ params }: PlayerProfilePageProps): Promise<Metadata> {
  const player = await getPlayer((await params).playerId);
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.profile;
  return { title: player ? `${player.fullName} — ${copy.badge}` : `${copy.badge} — El Padel`, description: player ? copy.description : undefined };
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const player = await getPlayer((await params).playerId);
  if (!player) notFound();
  return <PublicPlayerProfile player={player} />;
}
