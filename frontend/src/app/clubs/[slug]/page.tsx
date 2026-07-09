import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClubClient, type ClubClientDto } from '@/components/clubs/ClubClient';
import { apiUrl } from '@/lib/api';

type ClubPageProps = {
  params: Promise<{ slug: string }>;
};

type ClubDto = ClubClientDto;

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

  return <ClubClient club={club} />;
}
