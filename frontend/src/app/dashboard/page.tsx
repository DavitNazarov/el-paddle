import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerOverviewClient } from '@/components/dashboard/PlayerOverviewClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Dashboard — El Padel',
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role === 'JUDGE') redirect('/judge');
  if (!user.club) redirect('/complete-club');

  return <PlayerOverviewClient initialUser={user} />;
}
