import type { Metadata } from 'next';
import { AdminRegistrationsClient } from '@/components/admin/AdminRegistrationsClient';

export const metadata: Metadata = {
  title: 'Event registrations — Admin — El Padel',
};

export default async function AdminEventRegistrationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <AdminRegistrationsClient eventId={eventId} />;
}
