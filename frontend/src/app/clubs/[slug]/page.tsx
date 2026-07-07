import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/lib/api';

type ClubPageProps = {
  params: Promise<{ slug: string }>;
};

type ClubDto = {
  name: string;
  description: string;
  members: {
    id: string;
    roleTitle: string;
    user: {
      email: string;
      fullName: string;
    };
  }[];
};

async function getClub(slug: string) {
  const response = await fetch(apiUrl(`/api/public/clubs/${slug}`), {
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load club.');

  const data = (await response.json()) as { club: ClubDto };
  return data.club;
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  return {
    title: club ? `${club.name} — El Padel Club` : 'Club — El Padel',
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const club = await getClub(slug);

  if (!club) notFound();

  return (
    <main className="min-h-dvh bg-[var(--padel-ink)] px-5 py-6 text-[var(--padel-ivory)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="outline" className="border-[var(--padel-line)] bg-transparent text-[var(--padel-ivory)]">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>

        <section className="py-16">
          <Badge variant="gold">Club profile</Badge>
          <h1 className="font-display mt-5 text-5xl font-semibold md:text-7xl">{club.name}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">
            {club.description || 'Public club profile with team members listed by the administrator.'}
          </p>
        </section>

        <section className="border-t border-[var(--padel-line)] py-10">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-gold)]">
            <Users className="h-4 w-4" />
            Team members
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {club.members.map((member) => {
              return (
                <Card key={member.id} className="rounded-sm border-[var(--padel-line)] bg-[var(--padel-red)]/14 text-[var(--padel-ivory)]">
                  <CardContent className="p-5">
                    <p className="font-display text-2xl font-semibold">{member.user.fullName}</p>
                    <p className="mt-2 text-sm text-[var(--padel-muted)]">{member.user.email}</p>
                    {member.roleTitle ? <Badge variant="gold" className="mt-4">{member.roleTitle}</Badge> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!club.members.length ? (
            <Card className="mt-6 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red)]/14 text-[var(--padel-muted)]">
              <CardContent className="p-5">No members listed yet.</CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </main>
  );
}
