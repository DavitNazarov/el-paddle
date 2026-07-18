import type { Metadata } from 'next';
import { AdminRegistrationEventsClient } from '@/components/admin/AdminRegistrationEventsClient';

export const metadata: Metadata = {
  title: 'Registrations — Admin — El Padel',
};

export default function AdminRegistrationsPage() {
  return <AdminRegistrationEventsClient />;
}
