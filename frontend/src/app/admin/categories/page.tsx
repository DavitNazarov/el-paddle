import type { Metadata } from 'next';
import { AdminCategoriesClient } from '@/components/admin/AdminCategoriesClient';

export const metadata: Metadata = {
  title: 'Categories — Admin — El Padel',
};

export default function AdminCategoriesPage() {
  return <AdminCategoriesClient />;
}
