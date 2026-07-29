import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminApplicationsClient } from '@/components/admin/AdminApplicationsClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Club Requests — Admin — El Padel',
};

export default async function AdminApplicationsPage() {
  // Deciding who joins the platform is an admin act; organisers never see this.
  const user = await getCurrentUser();
  if (user?.role !== 'ADMIN') redirect('/admin');

  return <AdminApplicationsClient />;
}
