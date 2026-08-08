import { AdminCourtFocusClient } from '@/components/admin/AdminCourtFocusClient';
import { requireEventWorkspace } from '@/lib/adminAccess';

/**
 * One court's own address, so a screen can be parked on it for the day. Access
 * is the event workspace check the console itself uses — the court is only ever
 * a lens on an event the viewer already runs.
 */
export default async function AdminCourtFocusPage({ params }: { params: Promise<{ courtId: string; eventId: string }> }) {
  const { courtId, eventId } = await params;
  await requireEventWorkspace(eventId);
  return <AdminCourtFocusClient courtId={courtId} eventId={eventId} />;
}
