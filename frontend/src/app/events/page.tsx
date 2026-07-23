import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicEventsDirectory } from '@/components/tournament/PublicDirectoryClients';
import { apiUrl } from '@/lib/api';
import type { EventDto } from '@/types/dashboard';
import { normalizeLocale } from '@/lib/i18n';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get('elpadel_locale')?.value);
  const copy = tournamentCopy[locale].directories.events;
  return buildPageMetadata({
    title: `${copy.title} — El Padel`,
    description: copy.description,
    path: '/events',
  });
}

type PublicEventsResponse = { upcoming: EventDto | null; previous: EventDto[] };

async function getEvents() {
  const response = await fetch(apiUrl('/api/public/events'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load events.');
  const data = (await response.json()) as PublicEventsResponse;
  return { upcoming: data.upcoming ?? null, previous: Array.isArray(data.previous) ? data.previous : [] };
}

export default async function EventsPage() {
  const { upcoming, previous } = await getEvents();
  return <PublicEventsDirectory upcoming={upcoming} previous={previous} />;
}
