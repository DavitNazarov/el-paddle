import type { Metadata } from 'next';
import { RouteNotFound } from '@/components/tournament/RouteScreens';

export const metadata: Metadata = {
  title: 'Page not found — El Padel',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <RouteNotFound />;
}
