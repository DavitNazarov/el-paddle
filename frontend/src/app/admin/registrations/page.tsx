import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = {
  title: 'Entries — Admin — El Padel',
};

export default function AdminRegistrationsPage() {
  return <AdminEventToolIndexClient tool="registrations" />;
}
