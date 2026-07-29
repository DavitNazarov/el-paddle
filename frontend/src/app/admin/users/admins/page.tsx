import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';

export const metadata: Metadata = {
  title: 'Admins — Admin — El Padel',
};

export default async function AdminAdminsPage() {
  await requireAdminOnlyPage();
  return <AdminUsersClient role="ADMIN" />;
}
