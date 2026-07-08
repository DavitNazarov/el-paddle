import type { Metadata } from 'next';
import { AdminClubsClient } from '@/components/padel/admin/AdminClubsClient';

export const metadata: Metadata = {
  title: 'Clubs — Admin — El Padel',
};

export default function AdminClubsPage() {
  return <AdminClubsClient />;
}
