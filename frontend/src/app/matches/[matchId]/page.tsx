import type { Metadata } from 'next';
import { MatchDetailClient } from '@/components/tournament/MatchDetailClient';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';
import { JsonLd } from '@/components/seo/JsonLd';
import { apiUrl } from '@/lib/api';
import { breadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';

type PageProps = { params: Promise<{ matchId: string }> };

type MatchMeta = {
  id: string;
  eventTitle?: string;
  categoryName?: string;
  round?: string;
};

async function getMatchMeta(matchId: string): Promise<MatchMeta | null> {
  try {
    const response = await fetch(apiUrl(`/api/matches/${encodeURIComponent(matchId)}`), {
      next: { revalidate: 120 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      match?: {
        id: string;
        round?: string;
        bracket?: {
          event?: { title?: string };
          eventCategory?: { category?: { name?: string } };
        };
      };
    };
    const match = data.match;
    if (!match) return null;
    return {
      id: match.id,
      eventTitle: match.bracket?.event?.title,
      categoryName: match.bracket?.eventCategory?.category?.name,
      round: match.round,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params;
  const match = await getMatchMeta(matchId);
  const parts = [match?.eventTitle, match?.categoryName, match?.round].filter(Boolean);
  const title = parts.length ? `${parts.join(' · ')} — El Padel` : 'Match — El Padel';
  const description = parts.length
    ? `Public match details for ${parts.join(' · ')} at El Padel Tournament Tbilisi.`
    : 'Public padel match score, lineup, and tournament context.';

  return buildPageMetadata({
    title,
    description,
    path: `/matches/${matchId}`,
  });
}

export default async function MatchPage({ params }: PageProps) {
  const { matchId } = await params;
  const match = await getMatchMeta(matchId);

  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-[var(--padel-ivory)]"
    >
      {match ? (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Matches', path: '/matches' },
            { name: match.eventTitle || 'Match', path: `/matches/${match.id}` },
          ])}
        />
      ) : null}
      <CursorRing />
      <FilmGrain />
      <PadelNav />
      <main className="page-canvas relative min-h-dvh">
        <PageSurface />
        <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-32 md:px-8 md:pt-40">
          <MatchDetailClient matchId={matchId} />
        </section>
      </main>
      <SiteFooter />
      <PadelHomeStyles />
    </div>
  );
}
