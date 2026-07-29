import { AdminBracketClient } from '@/components/admin/AdminBracketClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

export default async function AdminBracketPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminBracketClient eventId={eventId} />;
}

