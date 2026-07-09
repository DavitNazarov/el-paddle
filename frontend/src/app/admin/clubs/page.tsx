import type { Metadata } from 'next';
import { AdminClubsClient } from '@/components/admin/AdminClubsClient';

export const metadata: Metadata = {
  title: 'Clubs — Admin — El Padel',
};

export default function AdminClubsPage() {
  return <AdminClubsClient />;
}
