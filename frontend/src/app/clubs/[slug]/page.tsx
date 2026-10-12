import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClubClient, type ClubClientDto, type ClubRecord } from '@/components/clubs/ClubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { apiUrl } from '@/lib/api';
import { breadcrumbJsonLd, buildPageMetadata, sportsClubJsonLd } from '@/lib/seo';

type ClubPageProps = {
  params: Promise<{ slug: string }>;
};

type ClubDto = ClubClientDto & { slug: string };

async function getClub(slug: string) {
  const response = await fetch(apiUrl(`/api/public/clubs/${slug}`), {
    next: { revalidate: 300 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load club.');

  const data = (await response.json()) as { club: ClubDto };
  return data.club;
}

/**
 * The club's tournament record. It is a second read, so it degrades on its own:
 * a roster that renders without its numbers is worth more than a club page that
 * fails because a count did not arrive.
 */
async function getClubRecord(slug: string): Promise<ClubRecord | null> {
  try {
    const response = await fetch(apiUrl(`/api/public/clubs/${slug}/stats`), { next: { revalidate: 300 } });
    if (!response.ok) return null;
    return ((await response.json()) as { stats?: ClubRecord }).stats ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  const title = club ? `${club.name} — El Padel Club` : 'Club — El Padel';
  const description = club?.description?.trim()
    || (club ? `Public roster and details for ${club.name} at El Padel Tournament Tbilisi.` : 'El Padel club directory.');

  return buildPageMetadata({
    title,
    description,
    path: `/clubs/${slug}`,
  });
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const [club, record] = await Promise.all([getClub(slug), getClubRecord(slug)]);

  if (!club) notFound();

  return (
    <>
      <JsonLd
        data={[
          sportsClubJsonLd(club),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Clubs', path: '/clubs' },
            { name: club.name, path: `/clubs/${club.slug}` },
          ]),
        ]}
      />
      <ClubClient club={club} record={record} />
    </>
  );
}
