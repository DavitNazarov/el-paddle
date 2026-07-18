import { AdminBracketClient } from '@/components/admin/AdminBracketClient';

export default async function AdminBracketPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <AdminBracketClient eventId={eventId} />;
}

