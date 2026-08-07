import { redirect } from 'next/navigation';
import { PlayerDrawClient } from '@/components/dashboard/event/PlayerDrawClient';
import { getCurrentUser } from '@/lib/auth';

export default async function PlayerDrawPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/events/${eventId}/draw`);
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect(`/admin/events/${eventId}`);
  if (user.role === 'JUDGE') redirect('/');
    return <PlayerDrawClient eventId={eventId} initialUser={user} />;
}
