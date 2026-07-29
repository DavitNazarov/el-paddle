import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminCategoriesClient } from '@/components/admin/AdminCategoriesClient';

export const metadata: Metadata = {
  title: 'Categories — Admin — El Padel',
};

export default async function AdminCategoriesPage() {
  await requireAdminOnlyPage();
  return <AdminCategoriesClient />;
}
