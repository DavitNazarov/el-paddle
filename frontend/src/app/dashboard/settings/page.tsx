import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerSettingsClient } from '@/components/dashboard/PlayerSettingsClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Settings — El Padel',
};

export default async function DashboardSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/settings');
  if (user.role === 'ADMIN') redirect('/admin/settings');
  if (user.role === 'ORGANISER') redirect('/admin');
  // The judge role has no player dashboard and no judge workspace; send it to the public site.
  if (user.role === 'JUDGE') redirect('/');
  if (!user.club) redirect('/complete-club');

  return <PlayerSettingsClient initialUser={user} />;
}
