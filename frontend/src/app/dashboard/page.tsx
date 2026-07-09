import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Dashboard — El Padel',
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  if (user.role === 'ADMIN') redirect('/admin');

  return <DashboardClient initialUser={user} />;
}
