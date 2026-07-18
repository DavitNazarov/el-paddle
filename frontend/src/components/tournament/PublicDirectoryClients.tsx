'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Activity, ArrowLeft, ArrowRight, Building2, CalendarDays, MapPin, Trophy, UserRound, Users } from 'lucide-react';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/dashboard';
import { MatchHistoryClient } from './MatchHistoryClient';

export type PublicClub = { id: string; name: string; slug: string };
export type PublicPlayer = {
  id: string;
  fullName: string;
  roleTitle: string;
  club: { id: string; name: string; slug: string } | null;
  stats: { matchesPlayed: number; wins: number; losses: number };
};

function PublicPageShell({ children, maxWidth = 'max-w-6xl' }: { children: ReactNode; maxWidth?: string }) {
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

export function PublicClubsDirectory({ clubs }: { clubs: PublicClub[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.clubs;
  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]"><Building2 className="h-4 w-4" />{clubs.length} {clubs.length === 1 ? copy.singular : copy.plural}</div>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => <Card key={club.id} className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)]"><CardContent className="p-5"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10"><Users className="h-5 w-5 text-[var(--padel-gold)]" /></div><h2 className="font-display mt-5 text-2xl font-semibold">{club.name}</h2><Link href={`/clubs/${club.slug}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">{copy.open}<ArrowRight className="h-4 w-4" /></Link></CardContent></Card>)}
      </div>
      {!clubs.length ? <Card className="mt-10 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-muted)]"><CardContent className="p-6">{copy.empty}</CardContent></Card> : null}
    </PublicPageShell>
  );
}

function EventCard({ event, label }: { event: EventDto; label: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  return (
    <Card className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)]"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10"><Trophy className="h-5 w-5 text-[var(--padel-gold)]" /></div><Badge variant="gold">{label}</Badge></div>
      <h2 className="font-display mt-5 text-2xl font-semibold">{event.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--padel-muted)]">{event.description}</p>
      <div className="mt-5 grid gap-3 border-t border-[var(--padel-line)] pt-5 text-sm"><p className="flex items-center gap-2 text-[var(--padel-muted)]"><CalendarDays className="h-4 w-4 text-[var(--padel-gold)]" />{formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' })}</p><p className="flex items-center gap-2 text-[var(--padel-muted)]"><MapPin className="h-4 w-4 text-[var(--padel-gold)]" />{event.location}</p></div>
      <div className="mt-4 flex flex-wrap gap-2"><Badge variant="gold">{tournamentStatus(locale, event.status)}</Badge>{event.categories.map((category) => <Badge key={category.id} variant="gold">{category.name}</Badge>)}</div>
      <Link href={`/events/${event.id}`} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">{copy.open}<ArrowRight className="h-4 w-4" /></Link>
    </CardContent></Card>
  );
}

export function PublicEventsDirectory({ upcoming, previous }: { upcoming: EventDto | null; previous: EventDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const count = (upcoming ? 1 : 0) + previous.length;
  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div><div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]"><Activity className="h-4 w-4" />{count} {count === 1 ? copy.singular : copy.plural}</div></div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">{upcoming ? <EventCard event={upcoming} label={copy.upcoming} /> : null}{previous.map((event) => <EventCard key={event.id} event={event} label={copy.previous} />)}</div>
      {!count ? <Card className="mt-10 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-muted)]"><CardContent className="p-6">{copy.empty}</CardContent></Card> : null}
    </PublicPageShell>
  );
}

export function PublicPlayersDirectory({ players }: { players: PublicPlayer[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.players;
  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div><div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]"><UserRound className="h-4 w-4" />{players.length} {players.length === 1 ? copy.singular : copy.plural}</div></div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{players.map((player) => <Card key={player.id} className="group relative cursor-pointer rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] focus-within:border-[var(--padel-gold)]"><Link href={`/players/${player.id}`} aria-label={fillTemplate(copy.view, { name: player.fullName })} className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--padel-red)]"><span className="sr-only">{fillTemplate(copy.view, { name: player.fullName })}</span></Link><CardContent className="p-5"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10"><UserRound className="h-5 w-5 text-[var(--padel-gold)]" /></div><h2 className="font-display mt-5 text-2xl font-semibold">{player.fullName}</h2><div className="mt-3 flex flex-wrap gap-2">{player.club ? <Link href={`/clubs/${player.club.slug}`} className="relative z-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"><Badge variant="gold">{player.club.name}</Badge></Link> : null}{player.roleTitle ? <Badge variant="gold">{player.roleTitle}</Badge> : null}</div><div className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--padel-line)] pt-4 text-sm">{[[copy.matches, player.stats.matchesPlayed], [copy.wins, player.stats.wins], [copy.losses, player.stats.losses]].map(([label, value]) => <div key={label}><p className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>)}</div></CardContent></Card>)}</div>
      {!players.length ? <Card className="mt-10 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-muted)]"><CardContent className="flex items-center gap-2 p-6"><Activity className="h-4 w-4" />{copy.empty}</CardContent></Card> : null}
    </PublicPageShell>
  );
}

export function PublicPlayerProfile({ player }: { player: PublicPlayer }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.profile;
  const stats = [[copy.matches, player.stats.matchesPlayed], [copy.wins, player.stats.wins], [copy.losses, player.stats.losses]] as const;
  return (
    <PublicPageShell>
      <Link href="/players" className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"><ArrowLeft className="h-4 w-4" />{copy.allPlayers}</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"><div><div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10"><UserRound className="h-9 w-9 text-[var(--padel-gold)]" /></div><Badge variant="gold" className="mt-6">{copy.badge}</Badge><h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{player.fullName}</h1><div className="mt-5 flex flex-wrap items-center gap-3">{player.roleTitle ? <Badge variant="gold">{player.roleTitle}</Badge> : null}{player.club ? <Link href={`/clubs/${player.club.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"><Building2 className="h-4 w-4" />{player.club.name}</Link> : null}</div></div><Card className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)]"><CardContent className="p-6"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--padel-gold)]">{copy.matchRecord}</p><div className="mt-6 grid grid-cols-3 gap-3">{stats.map(([label, value]) => <div key={label}><p className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{label}</p><p className="font-display mt-2 text-3xl">{value}</p></div>)}</div></CardContent></Card></div>
      <section className="mt-14 border-t border-[var(--padel-line)] pt-10" aria-labelledby="match-history-title"><Badge variant="gold">{copy.eventResults}</Badge><h2 id="match-history-title" className="font-display mt-4 text-4xl font-semibold md:text-5xl">{copy.matchHistory}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--padel-muted)]">{copy.description}</p><div className="mt-8"><MatchHistoryClient endpoint={`/api/players/${encodeURIComponent(player.id)}/matches`} /></div></section>
    </PublicPageShell>
  );
}

export function PublicMatchesPageClient() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.matches;
  return <PublicPageShell><Badge variant="gold">{copy.badge}</Badge><div className="mt-5"><h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p></div><div className="mt-10"><MatchHistoryClient /></div></PublicPageShell>;
}
