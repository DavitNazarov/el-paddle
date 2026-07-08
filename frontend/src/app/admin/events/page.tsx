import type { Metadata } from 'next';
import { AdminEventsClient } from '@/components/padel/admin/AdminEventsClient';

export const metadata: Metadata = {
  title: 'Events — Admin — El Padel',
};

export default function AdminEventsPage() {
  return <AdminEventsClient />;
}
