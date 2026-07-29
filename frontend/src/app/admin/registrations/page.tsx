import type { Metadata } from 'next';
import { requireAdminOnlyPage } from '@/lib/adminAccess';
import { AdminRegistrationEventsClient } from '@/components/admin/AdminRegistrationEventsClient';

export const metadata: Metadata = {
  title: 'Registrations — Admin — El Padel',
};

export default async function AdminRegistrationsPage() {
  await requireAdminOnlyPage();
  return <AdminRegistrationEventsClient />;
}
