import { AdminScheduleClient } from '@/components/admin/AdminScheduleClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export default async function AdminSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminScheduleClient eventId={eventId} />;
}

