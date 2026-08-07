import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerEventsClient } from '@/components/dashboard/PlayerEventsClient';
import { getPlayerDashboardData } from '@/lib/dashboard';

export const metadata: Metadata = {
  title: 'Events — El Padel',
};

export default async function DashboardEventsPage() {
  // One server fetch gates access and hydrates the client (F6) — no mount refetch.
  const data = await getPlayerDashboardData();
  if (!data) redirect('/login?next=/dashboard/events');
  const user = data.user;
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect('/admin');
  // The judge role has no player dashboard and no judge workspace; send it to the public site.
  if (user.role === 'JUDGE') redirect('/');
  if (!user.club) redirect('/complete-club');

  return <PlayerEventsClient initialUser={user} initialData={data} />;
}
