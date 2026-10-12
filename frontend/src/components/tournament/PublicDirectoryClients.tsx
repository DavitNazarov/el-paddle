'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Building2, Search, UserRound, Users } from 'lucide-react';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { MatchHistoryClient } from './MatchHistoryClient';
import { EmptyTournamentState } from './TournamentUI';

export type PublicClub = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  memberCount?: number;
};
export type PublicPlayer = {
  id: string;
  fullName: string;
  roleTitle: string;
  club: { id: string; name: string; slug: string } | null;
  stats: { matchesPlayed: number; wins: number; losses: number };
};

export function PublicPageShell({ children, maxWidth = 'max-w-6xl' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div style={padelVars} className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-[var(--padel-ivory)]">
      <CursorRing />
      <FilmGrain />
      <PadelNav />
      <main className="page-canvas relative min-h-dvh">
        <PageSurface />
        <section className={`relative z-10 mx-auto ${maxWidth} px-5 pb-16 pt-32 md:px-8 md:pt-40`}>{children}</section>
      </main>
      <SiteFooter />
      <PadelHomeStyles />
    </div>
  );
}

/**
 * A club's own mark, falling back to a monogram rather than to the same
 * anonymous icon on every card — a directory where every tile looks identical
 * cannot be scanned, only read.
 */
export function ClubCrest({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={`${box} shrink-0 rounded-full border border-[var(--padel-line)] object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10 font-display font-semibold text-[var(--padel-gold)] ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}
    >
      {initialsOf(name) || <Users className={size === 'lg' ? 'h-9 w-9' : 'h-5 w-5'} />}
    </span>
  );
}

export function PublicClubsDirectory({ clubs }: { clubs: PublicClub[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.clubs;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clubs;
    return clubs.filter((club) => [club.name, club.description ?? ''].join(' ').toLowerCase().includes(needle));
  }, [clubs, query]);

  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums">{clubs.length}</span> {clubs.length === 1 ? copy.singular : copy.plural}
        </div>
      </div>

      {clubs.length ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--padel-gold)]" aria-hidden="true" />
            <Input
              aria-label={copy.search}
              placeholder={copy.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 pl-10 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]"
            />
          </label>
          <p className="text-sm text-[var(--padel-muted)]" aria-live="polite">{fillTemplate(copy.shown, { shown: filtered.length, total: clubs.length })}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((club) => (
          <Card
            key={club.id}
            className="group relative flex cursor-pointer flex-col rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] focus-within:border-[var(--padel-gold)]"
          >
            <Link
              href={`/clubs/${club.slug}`}
              aria-label={fillTemplate(copy.view, { name: club.name })}
              className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--padel-red)]"
            >
              <span className="sr-only">{fillTemplate(copy.view, { name: club.name })}</span>
            </Link>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-4">
                <ClubCrest name={club.name} logoUrl={club.logoUrl} />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold leading-7">{club.name}</h2>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
                    <Users className="h-3.5 w-3.5 shrink-0 text-[var(--padel-gold)]" aria-hidden="true" />
                    {club.memberCount
                      ? <><span className="tabular-nums">{club.memberCount}</span> {copy.members.toLowerCase()}</>
                      : copy.noMembers}
                  </p>
                </div>
              </div>
              {club.description ? (
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--padel-muted)]">{club.description}</p>
              ) : null}
              <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-[var(--padel-gold)]">
                {copy.open}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!filtered.length ? (
        <div className="mt-10">
          <EmptyTournamentState
            title={clubs.length ? copy.searchEmpty : copy.empty}
            detail={clubs.length ? copy.searchEmptyDetail : copy.emptyDetail}
          />
        </div>
      ) : null}
    </PublicPageShell>
  );
}

function initialsOf(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('');
}

export function PlayerAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10 font-display font-semibold text-[var(--padel-gold)] ${size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-12 w-12 text-base'}`}
    >
      {initials || <UserRound className={size === 'lg' ? 'h-9 w-9' : 'h-5 w-5'} />}
    </span>
  );
}

function winRateOf(stats: PublicPlayer['stats']) {
  return stats.matchesPlayed ? Math.round((stats.wins / stats.matchesPlayed) * 100) : null;
}

export function PublicPlayersDirectory({ players }: { players: PublicPlayer[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.players;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((player) => [player.fullName, player.club?.name ?? ''].join(' ').toLowerCase().includes(needle));
  }, [players, query]);

  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]"><UserRound className="h-4 w-4" />{players.length} {players.length === 1 ? copy.singular : copy.plural}</div>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--padel-gold)]" aria-hidden="true" />
          <Input
            aria-label={copy.search}
            placeholder={copy.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 pl-10 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]"
          />
        </label>
        <p className="text-sm text-[var(--padel-muted)]" aria-live="polite">{fillTemplate(copy.shown, { shown: filtered.length, total: players.length })}</p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((player) => {
          const winRate = winRateOf(player.stats);
          return (
            <Card key={player.id} className="group relative cursor-pointer rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] focus-within:border-[var(--padel-gold)]">
              <Link href={`/players/${player.id}`} aria-label={fillTemplate(copy.view, { name: player.fullName })} className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--padel-red)]">
                <span className="sr-only">{fillTemplate(copy.view, { name: player.fullName })}</span>
              </Link>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <PlayerAvatar name={player.fullName} />
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-semibold leading-7">{player.fullName}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {player.club ? (
                        <Link href={`/clubs/${player.club.slug}`} className="relative z-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">
                          <Badge variant="gold">{player.club.name}</Badge>
                        </Link>
                      ) : null}
                      {player.roleTitle ? <Badge variant="gold">{player.roleTitle}</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[var(--padel-line)] pt-4 text-sm">
                  {([[copy.matches, String(player.stats.matchesPlayed)], [copy.wins, String(player.stats.wins)], [copy.losses, String(player.stats.losses)], [copy.winRate, winRate === null ? '—' : `${winRate}%`]] as const).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{label}</p>
                      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!filtered.length ? (
        <div className="mt-10"><EmptyTournamentState title={players.length ? copy.searchEmpty : copy.empty} /></div>
      ) : null}
    </PublicPageShell>
  );
}

export function PublicPlayerProfile({ player }: { player: PublicPlayer }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.profile;
  const stats = [[copy.matches, player.stats.matchesPlayed], [copy.wins, player.stats.wins], [copy.losses, player.stats.losses]] as const;
  const winRate = winRateOf(player.stats);
  return (
    <PublicPageShell>
      <Link href="/players" className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"><ArrowLeft className="h-4 w-4" />{copy.allPlayers}</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-5">
            <PlayerAvatar name={player.fullName} size="lg" />
            <Badge variant="gold">{copy.badge}</Badge>
          </div>
          <h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{player.fullName}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {player.roleTitle ? <Badge variant="gold">{player.roleTitle}</Badge> : null}
            {player.club ? (
              <Link href={`/clubs/${player.club.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">
                <Building2 className="h-4 w-4" aria-hidden="true" />{player.club.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-muted)]"><Building2 className="h-4 w-4" aria-hidden="true" />{copy.noClub}</span>
            )}
          </div>
        </div>
        <Card className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)]">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--padel-gold)]">{copy.matchRecord}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <p className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{label}</p>
                  <p className="font-display mt-2 text-3xl tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-[var(--padel-line)] pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{copy.winRate}</p>
                <p className="font-display text-2xl tabular-nums">{winRate === null ? '—' : `${winRate}%`}</p>
              </div>
              {winRate === null ? (
                <p className="mt-2 text-sm leading-6 text-[var(--padel-muted)]">{copy.noMatchesYet}</p>
              ) : (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--padel-ivory)]/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-[var(--padel-gold)]" style={{ width: `${winRate}%` }} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--padel-muted)]">{fillTemplate(copy.winRateOf, { wins: player.stats.wins, matches: player.stats.matchesPlayed })}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="mt-14 border-t border-[var(--padel-line)] pt-10" aria-labelledby="match-history-title"><Badge variant="gold">{copy.eventResults}</Badge><h2 id="match-history-title" className="font-display mt-4 text-4xl font-semibold md:text-5xl">{copy.matchHistory}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--padel-muted)]">{copy.description}</p><div className="mt-8"><MatchHistoryClient endpoint={`/api/players/${encodeURIComponent(player.id)}/matches`} /></div></section>
    </PublicPageShell>
  );
}

export function PublicMatchesPageClient() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.matches;
  return <PublicPageShell><Badge variant="gold">{copy.badge}</Badge><div className="mt-5"><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div><div className="mt-10"><MatchHistoryClient /></div></PublicPageShell>;
}
