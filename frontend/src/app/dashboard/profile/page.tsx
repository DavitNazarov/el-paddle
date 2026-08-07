import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlayerProfileClient } from '@/components/dashboard/PlayerProfileClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'My Profile — El Padel',
};

export default async function DashboardProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard/profile');
  // Admins and organisers keep their profile inside the admin settings screen.
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect('/admin/settings');
  // The judge role has no player dashboard and no judge workspace; send it to the public site.
  if (user.role === 'JUDGE') redirect('/');
  if (!user.club) redirect('/complete-club');

  return <PlayerProfileClient initialUser={user} />;
}
