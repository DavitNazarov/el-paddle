import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { PublicPlayerProfile, type PublicPlayer } from '@/components/tournament/PublicDirectoryClients';
import { JsonLd } from '@/components/seo/JsonLd';
import { apiUrl } from '@/lib/api';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { breadcrumbJsonLd, buildPageMetadata, personJsonLd } from '@/lib/seo';

type PlayerProfilePageProps = { params: Promise<{ playerId: string }> };

async function getPlayer(playerId: string) {
  const response = await fetch(apiUrl(`/api/public/players/${encodeURIComponent(playerId)}`), { next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load player profile.');
  return ((await response.json()) as { player: PublicPlayer }).player;
}

export async function generateMetadata({ params }: PlayerProfilePageProps): Promise<Metadata> {
  const { playerId } = await params;
  const player = await getPlayer(playerId);
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.profile;
  const title = player ? `${player.fullName} — ${copy.badge}` : `${copy.badge} — El Padel`;
  const description = player
    ? `${player.fullName}${player.club ? ` · ${player.club.name}` : ''}. ${copy.description}`
    : copy.description;

  return buildPageMetadata({
    title,
    description,
    path: `/players/${playerId}`,
  });
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const player = await getPlayer((await params).playerId);
  if (!player) notFound();

  return (
    <>
      <JsonLd
        data={[
          personJsonLd({
            id: player.id,
            fullName: player.fullName,
            clubName: player.club?.name,
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Players', path: '/players' },
            { name: player.fullName, path: `/players/${player.id}` },
          ]),
        ]}
      />
      <PublicPlayerProfile player={player} />
    </>
  );
}
