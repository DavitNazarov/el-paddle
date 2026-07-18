import { PublicTournamentClient } from '@/components/tournament/PublicTournamentClient';

export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) { const { eventId } = await params; return <div className="tournament-app"><PublicTournamentClient eventId={eventId} /></div>; }
