import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';

export const metadata: Metadata = {
  title: 'Organisers — Admin — El Padel',
};

export default async function AdminOrganisersPage() {
  await requireAdminOnlyPage();
  return <AdminUsersClient role="ORGANISER" />;
}
