'use client';

import dynamic from 'next/dynamic';

export const HistorySection = dynamic(
  () => import('./HistorySection').then((m) => m.HistorySection),
  { ssr: false, loading: () => null },
);

export const CourtsSection = dynamic(
  () => import('./CourtsSection').then((m) => m.CourtsSection),
  { ssr: false, loading: () => null },
);

export const CompetitionSection = dynamic(
  () => import('./CompetitionSection').then((m) => m.CompetitionSection),
  { ssr: false, loading: () => null },
);

export const FeaturesSection = dynamic(
  () => import('./FeaturesSection').then((m) => m.FeaturesSection),
  { ssr: false, loading: () => null },
);

export const SponsorsSection = dynamic(
  () => import('./SponsorsSection').then((m) => m.SponsorsSection),
  { ssr: false, loading: () => null },
);

export const RegistrationSection = dynamic(
  () => import('./RegistrationSection').then((m) => m.RegistrationSection),
  { ssr: false, loading: () => null },
);

export const WeatherRouteSection = dynamic(
  () => import('./WeatherRouteSection').then((m) => m.WeatherRouteSection),
  { ssr: false, loading: () => null },
);

export const ContactSection = dynamic(
  () => import('./ContactSection').then((m) => m.ContactSection),
  { ssr: false, loading: () => null },
);
