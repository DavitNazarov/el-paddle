import type { Metadata } from 'next';
import { AdminRegistrationsClient } from '@/components/padel/admin/AdminRegistrationsClient';

export const metadata: Metadata = {
  title: 'Registrations — Admin — El Padel',
};

export default function AdminRegistrationsPage() {
  return <AdminRegistrationsClient />;
}
