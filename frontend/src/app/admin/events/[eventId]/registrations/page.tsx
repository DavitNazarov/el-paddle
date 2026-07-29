import type { Metadata } from 'next';
import { AdminRegistrationsClient } from '@/components/admin/AdminRegistrationsClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export const metadata: Metadata = {
  title: 'Event registrations — Admin — El Padel',
};

export default async function AdminEventRegistrationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminRegistrationsClient eventId={eventId} />;
}
