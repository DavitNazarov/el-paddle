import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClubClient, type ClubClientDto } from '@/components/clubs/ClubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { apiUrl } from '@/lib/api';
import { breadcrumbJsonLd, buildPageMetadata, sportsClubJsonLd } from '@/lib/seo';

type ClubPageProps = {
  params: Promise<{ slug: string }>;
};

type ClubDto = ClubClientDto & { slug: string };

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
  const club = await getClub(slug);

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
      <ClubClient club={club} />
    </>
  );
}
