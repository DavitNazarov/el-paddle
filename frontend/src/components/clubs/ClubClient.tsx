'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/shared/I18nProvider';
import { PlayerAvatar, PublicPageShell } from '@/components/tournament/PublicDirectoryClients';
import { fillTemplate } from '@/lib/i18n/tournament';

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

export function ClubClient({ club }: { club: ClubClientDto }) {
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

      <div className="mt-8 flex flex-wrap items-center gap-5">
        {club.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.logoUrl} alt="" className="h-20 w-20 shrink-0 rounded-full border border-[var(--padel-line)] object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] bg-[var(--padel-ivory)]/10">
            <Users className="h-9 w-9 text-[var(--padel-gold)]" aria-hidden="true" />
          </span>
        )}
        <Badge variant="gold">{copy.badge}</Badge>
      </div>
      <h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{club.name}</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">
        {club.description || copy.fallbackDescription}
      </p>

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

        {!club.members.length ? (
          <Card className="mt-6 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-muted)]">
            <CardContent className="p-6">{copy.empty}</CardContent>
          </Card>
        ) : !filtered.length ? (
          <Card className="mt-6 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 text-[var(--padel-muted)]">
            <CardContent className="p-6">{copy.searchEmpty}</CardContent>
          </Card>
        ) : null}
      </section>
    </PublicPageShell>
  );
}
