'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/shared/I18nProvider';
import { ClubCrest, PlayerAvatar, PublicPageShell } from '@/components/tournament/PublicDirectoryClients';
import { EmptyTournamentState } from '@/components/tournament/TournamentUI';
import { fillTemplate } from '@/lib/i18n/tournament';

/** What the club has done on court, from `/api/public/clubs/:slug/stats`. */
export type ClubRecord = {
  members: number;
  eventsEntered: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  titles: number;
};

export type ClubClientDto = {
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  members: {
    id: string;
    membershipRole: 'LEADER' | 'MEMBER';
    roleTitle: string;
    /** Set only when the member resolves on /players/:id (active players). */
    playerId?: string | null;
    user: {
      fullName: string;
    };
  }[];
};

/**
 * The club's tournament record, read the same way a player's is: the counts
 * first, then the one derived number a visitor actually compares clubs on.
 * Titles are singled out because a final is the only match that ends a draw.
 */
function ClubRecordCard({ record }: { record: ClubRecord }) {
  const { dictionary } = useI18n();
  const copy = dictionary.club.record;
  const winRate = record.matchesPlayed ? Math.round((record.wins / record.matchesPlayed) * 100) : null;
  // The roster below states the club's size, and it drops admin accounts that
  // `record.members` still counts. Saying it twice would say it two ways.
  const counts: Array<[string, number]> = [
    [copy.eventsEntered, record.eventsEntered],
    [copy.matchesPlayed, record.matchesPlayed],
    [copy.wins, record.wins],
    [copy.losses, record.losses],
  ];

  return (
    <Card className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)]">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--padel-gold)]">{copy.title}</p>
          {record.titles ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span className="tabular-nums">{record.titles}</span> {copy.titles.toLowerCase()}
            </p>
          ) : null}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
          {counts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[0.65rem] font-semibold uppercase text-[var(--padel-muted)]">{label}</dt>
              <dd className="font-display mt-1.5 text-3xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

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
              <p className="mt-2 text-sm leading-6 text-[var(--padel-muted)]">
                {fillTemplate(copy.winRateOf, { wins: record.wins, matches: record.matchesPlayed })}
              </p>
            </>
          )}
        </div>

        <p className="mt-5 text-xs leading-5 text-[var(--padel-muted)]">{copy.description}</p>
      </CardContent>
    </Card>
  );
}

export function ClubClient({ club, record = null }: { club: ClubClientDto; record?: ClubRecord | null }) {
  const { dictionary } = useI18n();
  const copy = dictionary.club;
  const [query, setQuery] = useState('');

  const members = useMemo(() => [...club.members].sort((a, b) => {
    if (a.membershipRole !== b.membershipRole) return a.membershipRole === 'LEADER' ? -1 : 1;
    return a.user.fullName.localeCompare(b.user.fullName);
  }), [club.members]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => [member.user.fullName, member.roleTitle].join(' ').toLowerCase().includes(needle));
  }, [members, query]);

  return (
    <PublicPageShell>
      <Link href="/clubs" className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {copy.allClubs}
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-5">
            <ClubCrest name={club.name} logoUrl={club.logoUrl} size="lg" />
            <Badge variant="gold">{copy.badge}</Badge>
          </div>
          <h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{club.name}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">
            {club.description || copy.fallbackDescription}
          </p>
        </div>
        {record ? <ClubRecordCard record={record} /> : null}
      </div>

      <section className="mt-12 border-t border-[var(--padel-line)] pt-10" aria-labelledby="club-members-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="club-members-title" className="font-display text-4xl font-semibold md:text-5xl">{copy.members}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--padel-muted)]">{copy.membersDescription}</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]">
            <Users className="h-4 w-4" aria-hidden="true" />
            {club.members.length} {club.members.length === 1 ? copy.singular : copy.plural}
          </div>
        </div>

        {club.members.length ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="text-sm text-[var(--padel-muted)]" aria-live="polite">
              {fillTemplate(copy.shown, { shown: filtered.length, total: club.members.length })}
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <Card
              key={member.id}
              className={`relative rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-ivory)] transition-colors duration-200 ${member.playerId ? 'group cursor-pointer hover:border-[var(--padel-gold)] focus-within:border-[var(--padel-gold)]' : ''}`}
            >
              {member.playerId ? (
                <Link
                  href={`/players/${member.playerId}`}
                  aria-label={fillTemplate(copy.viewProfile, { name: member.user.fullName })}
                  className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--padel-red)]"
                >
                  <span className="sr-only">{fillTemplate(copy.viewProfile, { name: member.user.fullName })}</span>
                </Link>
              ) : null}
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <PlayerAvatar name={member.user.fullName} />
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-semibold leading-7">{member.user.fullName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {member.membershipRole === 'LEADER' ? <Badge variant="gold">{copy.leader}</Badge> : null}
                      {member.roleTitle ? <Badge variant="gold">{member.roleTitle}</Badge> : null}
                    </div>
                  </div>
                </div>
                {member.playerId ? (
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--padel-gold)]">
                    {copy.openProfile}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {!filtered.length ? (
          <div className="mt-6"><EmptyTournamentState title={club.members.length ? copy.searchEmpty : copy.empty} /></div>
        ) : null}
      </section>
    </PublicPageShell>
  );
}
