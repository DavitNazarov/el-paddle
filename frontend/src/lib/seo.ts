import type { Metadata } from 'next';
import { legalBusiness } from '@/lib/legal';

export const SITE_NAME = 'El Padel Tournament Tbilisi';
export const SITE_TAGLINE = 'Every Point Is Honor';
export const DEFAULT_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const DEFAULT_DESCRIPTION =
  'El Padel Tournament Tbilisi. ქართული პადელის ტურნირის 9-სექციანი გამოცდილება: ისტორია, კორტები, შეჯიბრი, სპონსორები, რეგისტრაცია, ამინდი, მარშრუტი და კონტაქტი.';
export const DEFAULT_OG_IMAGE_PATH = '/images/el-padel-player-poster.jpeg';

/**
 * Canonical production origin. Prefer NEXT_PUBLIC_SITE_URL in deploy env.
 * Falls back to NEXT_PUBLIC_APP_URL, then the first FRONTEND_URL entry,
 * then https://elpadell.com in production (matches DEPLOY.md / .env.example).
 */
export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.FRONTEND_URL?.split(',')[0],
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /^https?:\/\//i.test(value)) {
      return value.replace(/\/$/, '');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://elpadell.com';
  }

  return 'http://localhost:3000';
}

export function absoluteUrl(path = '/'): string {
  const base = getSiteUrl();
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function absoluteAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return absoluteUrl(path);
}

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  imagePath = DEFAULT_OG_IMAGE_PATH,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteAssetUrl(imagePath);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['ka_GE'],
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export const noIndexMetadata: Pick<Metadata, 'robots'> = {
  robots: { index: false, follow: false },
};

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: legalBusiness.name || SITE_NAME,
    legalName: legalBusiness.name || SITE_NAME,
    url: getSiteUrl(),
    logo: absoluteAssetUrl('/images/el-padel-logo.png'),
    image: absoluteAssetUrl(DEFAULT_OG_IMAGE_PATH),
    email: legalBusiness.email || undefined,
    telephone: legalBusiness.phone || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tbilisi',
      addressCountry: 'GE',
      streetAddress: legalBusiness.address || undefined,
    },
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: getSiteUrl(),
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'SportsOrganization',
      name: legalBusiness.name || SITE_NAME,
    },
    inLanguage: ['en', 'ka'],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function sportsEventJsonLd(event: {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  location: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    description: event.description || undefined,
    startDate: event.date,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: absoluteUrl(`/events/${event.id}`),
    image: absoluteAssetUrl(DEFAULT_OG_IMAGE_PATH),
    location: {
      '@type': 'Place',
      name: event.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tbilisi',
        addressCountry: 'GE',
        streetAddress: event.location,
      },
    },
    organizer: {
      '@type': 'SportsOrganization',
      name: legalBusiness.name || SITE_NAME,
      url: getSiteUrl(),
    },
    sport: 'Padel',
  };
}

export function sportsClubJsonLd(club: { name: string; description?: string | null; slug: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsClub',
    name: club.name,
    description: club.description || undefined,
    url: absoluteUrl(`/clubs/${club.slug}`),
    sport: 'Padel',
    memberOf: {
      '@type': 'SportsOrganization',
      name: legalBusiness.name || SITE_NAME,
      url: getSiteUrl(),
    },
  };
}

export function personJsonLd(player: { id: string; fullName: string; clubName?: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.fullName,
    url: absoluteUrl(`/players/${player.id}`),
    ...(player.clubName
      ? {
          memberOf: {
            '@type': 'SportsClub',
            name: player.clubName,
          },
        }
      : {}),
  };
}
