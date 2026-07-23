import type { Metadata } from 'next';
import { PublicTournamentClient } from '@/components/tournament/PublicTournamentClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { apiUrl } from '@/lib/api';
import type { EventDto } from '@/types/dashboard';
import { breadcrumbJsonLd, buildPageMetadata, sportsEventJsonLd } from '@/lib/seo';

type PageProps = { params: Promise<{ eventId: string }> };

async function getPublicEvent(eventId: string): Promise<EventDto | null> {
  try {
    const response = await fetch(apiUrl(`/api/public/events/${encodeURIComponent(eventId)}`), {
      next: { revalidate: 300 },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const data = (await response.json()) as { event?: EventDto };
    return data.event ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getPublicEvent(eventId);
  const title = event ? `${event.title} — El Padel` : 'Event — El Padel';
  const description = event
    ? [event.description?.trim(), `${event.location} · ${new Date(event.date).toLocaleDateString('en-GB')}`]
        .filter(Boolean)
        .join(' ')
    : 'Published El Padel tournament bracket, schedule, and results.';

  return buildPageMetadata({
    title,
    description,
    path: `/events/${eventId}`,
  });
}

export default async function PublicEventPage({ params }: PageProps) {
  const { eventId } = await params;
  const event = await getPublicEvent(eventId);

  return (
    <div className="tournament-app">
      {event ? (
        <JsonLd
          data={[
            sportsEventJsonLd(event),
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Events', path: '/events' },
              { name: event.title, path: `/events/${event.id}` },
            ]),
          ]}
        />
      ) : null}
      <PublicTournamentClient eventId={eventId} />
    </div>
  );
}
