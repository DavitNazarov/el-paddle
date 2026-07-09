import type { Metadata } from 'next';
import { AdminEventsClient } from '@/components/admin/AdminEventsClient';

export const metadata: Metadata = {
  title: 'Events — Admin — El Padel',
};

export default function AdminEventsPage() {
  return <AdminEventsClient />;
}
