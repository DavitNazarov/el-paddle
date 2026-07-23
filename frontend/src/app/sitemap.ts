import type { MetadataRoute } from 'next';
import { apiUrl } from '@/lib/api';
import { legalDocumentSlugs } from '@/lib/legal';
import { absoluteUrl } from '@/lib/seo';

type SitemapEvent = { id: string; updatedAt?: string; date?: string };
type SitemapClub = { slug: string };
type SitemapPlayer = { id: string };

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(apiUrl(path), {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function entry(
  path: string,
  options: {
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
    lastModified?: string | Date;
  },
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified: options.lastModified ? new Date(options.lastModified) : new Date(),
    changeFrequency: options.changeFrequency,
    priority: options.priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    entry('/', { changeFrequency: 'weekly', priority: 1 }),
    entry('/events', { changeFrequency: 'daily', priority: 0.9 }),
    entry('/clubs', { changeFrequency: 'weekly', priority: 0.8 }),
    entry('/players', { changeFrequency: 'weekly', priority: 0.8 }),
    entry('/matches', { changeFrequency: 'daily', priority: 0.7 }),
    ...legalDocumentSlugs.map((document) =>
      entry(`/legal/${document}`, { changeFrequency: 'yearly', priority: 0.3 }),
    ),
  ];

  const [eventsPayload, clubsPayload, playersPayload] = await Promise.all([
    fetchJson<{ events?: SitemapEvent[] }>('/api/public/sitemap-events'),
    fetchJson<{ clubs?: SitemapClub[] }>('/api/public/clubs'),
    fetchJson<{ players?: SitemapPlayer[] }>('/api/public/players'),
  ]);

  const eventRoutes =
    eventsPayload?.events?.map((event) =>
      entry(`/events/${event.id}`, {
        changeFrequency: 'daily',
        priority: 0.85,
        lastModified: event.updatedAt ?? event.date,
      }),
    ) ?? [];

  const clubRoutes =
    clubsPayload?.clubs?.map((club) =>
      entry(`/clubs/${club.slug}`, {
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    ) ?? [];

  const playerRoutes =
    playersPayload?.players?.map((player) =>
      entry(`/players/${player.id}`, {
        changeFrequency: 'weekly',
        priority: 0.5,
      }),
    ) ?? [];

  return [...staticRoutes, ...eventRoutes, ...clubRoutes, ...playerRoutes];
}
