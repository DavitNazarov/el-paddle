import { AdminOpponentRequestsClient } from '@/components/admin/AdminOpponentRequestsClient';

export default async function AdminOpponentRequestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <AdminOpponentRequestsClient eventId={eventId} />;
}

