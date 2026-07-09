import type { Metadata } from 'next';
import { AdminOverviewClient } from '@/components/admin/AdminOverviewClient';

export const metadata: Metadata = {
  title: 'Admin — El Padel',
};

export default function AdminPage() {
  return <AdminOverviewClient />;
}
