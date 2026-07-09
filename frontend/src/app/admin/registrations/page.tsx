import type { Metadata } from 'next';
import { AdminRegistrationsClient } from '@/components/admin/AdminRegistrationsClient';

export const metadata: Metadata = {
  title: 'Registrations — Admin — El Padel',
};

export default function AdminRegistrationsPage() {
  return <AdminRegistrationsClient />;
}
