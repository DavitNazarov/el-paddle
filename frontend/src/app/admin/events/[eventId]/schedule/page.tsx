import { AdminScheduleClient } from '@/components/admin/AdminScheduleClient';

export default async function AdminSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <AdminScheduleClient eventId={eventId} />;
}

