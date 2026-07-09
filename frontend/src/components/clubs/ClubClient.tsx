'use client';

import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';

export type ClubClientDto = {
  name: string;
  description: string;
  members: {
    id: string;
    roleTitle: string;
    user: {
      fullName: string;
    };
  }[];
};

export function ClubClient({ club }: { club: ClubClientDto }) {
  const { dictionary } = useI18n();
  const copy = dictionary.club;

  return (
    <main className="min-h-dvh bg-[var(--padel-ink)] px-5 py-6 text-[var(--padel-ivory)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Button asChild variant="outline" className="border-[var(--padel-line)] bg-transparent text-[var(--padel-ivory)]">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {copy.home}
            </Link>
          </Button>
          <LanguageSwitcher tone="dark" />
        </header>

        <section className="py-16">
          <Badge variant="gold">{copy.badge}</Badge>
          <h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{club.name}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">
            {club.description || copy.fallbackDescription}
          </p>
        </section>

        <section className="border-t border-[var(--padel-line)] py-10">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-gold)]">
            <Users className="h-4 w-4" />
            {copy.members}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {club.members.map((member) => (
              <Card key={member.id} className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red)]/14 text-[var(--padel-ivory)]">
                <CardContent className="p-5">
                  <p className="font-display text-2xl font-semibold">{member.user.fullName}</p>
                  {member.roleTitle ? <Badge variant="gold" className="mt-4">{member.roleTitle}</Badge> : null}
                </CardContent>
              </Card>
            ))}
          </div>
          {!club.members.length ? (
            <Card className="mt-6 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red)]/14 text-[var(--padel-muted)]">
              <CardContent className="p-5">{copy.empty}</CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </main>
  );
}
