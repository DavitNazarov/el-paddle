import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8c1916',
};

export const metadata: Metadata = {
  title: 'El Padel Tournament Tbilisi — Every Point Is Honor',
  description:
    'El Padel Tournament Tbilisi. A matador-spirited padel event: premium, competitive and welcoming. Deep red editorial design with poster-inspired sections, registration and an interactive 3D padel ball.',
  icons: {
    icon: '/images/el-padel-logo-mark.png',
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
