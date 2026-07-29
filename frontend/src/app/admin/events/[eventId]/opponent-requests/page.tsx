import { AdminOpponentRequestsClient } from '@/components/admin/AdminOpponentRequestsClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export default async function AdminOpponentRequestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminOpponentRequestsClient eventId={eventId} />;
}

