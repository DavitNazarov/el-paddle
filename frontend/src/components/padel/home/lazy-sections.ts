'use client';

import dynamic from 'next/dynamic';
import { createElement } from 'react';

function DeferredSectionLoader() {
  return createElement('div', {
    className: 'deferred-section-loader',
    'aria-hidden': true,
  });
}

export const HistorySection = dynamic(
  () => import('./HistorySection').then((module) => module.HistorySection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const CourtsSection = dynamic(
  () => import('./CourtsSection').then((module) => module.CourtsSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const CompetitionSection = dynamic(
  () => import('./CompetitionSection').then((module) => module.CompetitionSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const FeaturesSection = dynamic(
  () => import('./FeaturesSection').then((module) => module.FeaturesSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const SponsorsSection = dynamic(
  () => import('./SponsorsSection').then((module) => module.SponsorsSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const RegistrationSection = dynamic(
  () => import('./RegistrationSection').then((module) => module.RegistrationSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const WeatherRouteSection = dynamic(
  () => import('./WeatherRouteSection').then((module) => module.WeatherRouteSection),
  { ssr: false, loading: DeferredSectionLoader },
);

export const ContactSection = dynamic(
  () => import('./ContactSection').then((module) => module.ContactSection),
  { ssr: false, loading: DeferredSectionLoader },
);
