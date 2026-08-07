import { redirect } from 'next/navigation';
import { PlayerTournamentEventClient } from '@/components/dashboard/PlayerTournamentEventClient';
import { getCurrentUser } from '@/lib/auth';

export default async function PlayerTournamentEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/events/${eventId}`);
  if (user.role === 'ADMIN' || user.role === 'ORGANISER') redirect(`/admin/events/${eventId}`);
  if (user.role === 'JUDGE') redirect('/');
    return <PlayerTournamentEventClient eventId={eventId} initialUser={user} />;
}

