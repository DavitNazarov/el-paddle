import { redirect } from 'next/navigation';
import { PlayerEventMatchesClient } from '@/components/dashboard/event/PlayerEventMatchesClient';
import { getCurrentUser } from '@/lib/auth';

export default async function PlayerEventMatchesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/events/${eventId}/matches`);
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect(`/admin/events/${eventId}`);
  if (user.role === 'JUDGE') redirect('/');
  return <PlayerEventMatchesClient eventId={eventId} initialUser={user} />;
}
