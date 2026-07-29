import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminClubsClient } from '@/components/admin/AdminClubsClient';

export const metadata: Metadata = {
  title: 'Clubs — Admin — El Padel',
};

export default async function AdminClubsPage() {
  await requireAdminOnlyPage();
  return <AdminClubsClient />;
}
