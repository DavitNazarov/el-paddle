import { AdminEventControlClient } from '@/components/admin/AdminEventControlClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export default async function AdminEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminEventControlClient eventId={eventId} />;
}

