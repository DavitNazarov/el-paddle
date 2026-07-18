import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerEntriesClient } from '@/components/dashboard/PlayerEntriesClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Entries — El Padel',
};

export default async function DashboardEntriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/entries');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role === 'JUDGE') redirect('/judge');
  if (!user.club) redirect('/complete-club');

  return <PlayerEntriesClient initialUser={user} />;
}
