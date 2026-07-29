import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';

export const metadata: Metadata = {
  title: 'Players — Admin — El Padel',
};

export default async function AdminPlayersPage() {
  await requireAdminOnlyPage();
  return <AdminUsersClient role="USER" />;
}
