import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerEntriesClient } from '@/components/dashboard/PlayerEntriesClient';
import { getPlayerDashboardData } from '@/lib/dashboard';

export const metadata: Metadata = {
  title: 'Entries — El Padel',
};

export default async function DashboardEntriesPage() {
  // One server fetch gates access and hydrates the client (F6) — no mount refetch.
  const data = await getPlayerDashboardData();
  if (!data) redirect('/login?next=/dashboard/entries');
  const user = data.user;
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect('/admin');
  // The judge role has no player dashboard and no judge workspace; send it to the public site.
  if (user.role === 'JUDGE') redirect('/');
  if (!user.club) redirect('/complete-club');

  return <PlayerEntriesClient initialUser={user} initialData={data} />;
}
