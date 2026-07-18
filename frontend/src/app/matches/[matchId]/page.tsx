import { MatchDetailClient } from '@/components/tournament/MatchDetailClient';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-[var(--padel-ivory)]"
    >
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
