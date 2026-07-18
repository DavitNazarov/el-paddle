import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerEventsClient } from '@/components/dashboard/PlayerEventsClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Events — El Padel',
};

export default async function DashboardEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/events');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role === 'JUDGE') redirect('/judge');
  if (!user.club) redirect('/complete-club');

  return <PlayerEventsClient initialUser={user} />;
}
