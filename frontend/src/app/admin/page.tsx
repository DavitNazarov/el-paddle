import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminClient } from '@/components/padel/AdminClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Admin — El Padel',
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  return <AdminClient />;
}
