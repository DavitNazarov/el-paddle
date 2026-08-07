import { AdminMatchControlClient } from '@/components/admin/AdminMatchControlClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export default async function AdminMatchControlPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminMatchControlClient eventId={eventId} />;
}
