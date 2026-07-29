import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';

export const metadata: Metadata = {
  title: 'Judges — Admin — El Padel',
};

export default async function AdminJudgesPage() {
  await requireAdminOnlyPage();
  return <AdminUsersClient role="JUDGE" />;
}
