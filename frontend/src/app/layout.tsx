import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { normalizeLocale } from '@/lib/i18n';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#86000c',
};

export const metadata: Metadata = {
  title: 'El Padel Tournament Tbilisi — Every Point Is Honor',
  description:
    'El Padel Tournament Tbilisi. ქართული პადელის ტურნირის 9-სექციანი გამოცდილება: ისტორია, კორტები, შეჯიბრი, სპონსორები, რეგისტრაცია, ამინდი, მარშრუტი და კონტაქტი.',
  icons: {
    icon: '/images/el-padel-logo-mark.png',
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get('elpadel_locale')?.value);

  return (
    <html lang={initialLocale}>
      <body>
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
