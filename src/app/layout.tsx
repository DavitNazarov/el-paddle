import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Inter, Luxurious_Script } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const luxuriousScript = Luxurious_Script({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
});

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
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${luxuriousScript.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
