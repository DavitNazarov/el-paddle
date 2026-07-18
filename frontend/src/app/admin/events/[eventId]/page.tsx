import { AdminEventControlClient } from '@/components/admin/AdminEventControlClient';

export default async function AdminEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <AdminEventControlClient eventId={eventId} />;
}

