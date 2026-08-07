import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerClubClient } from '@/components/clubs/PlayerClubClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'My Club — El Padel',
};

export default async function PlayerClubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/club');
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect('/admin');
  // The judge role has no player dashboard and no judge workspace; send it to the public site.
  if (user.role === 'JUDGE') redirect('/');
  if (!user.club) redirect('/complete-club');

  return <PlayerClubClient initialUser={user} />;
}
