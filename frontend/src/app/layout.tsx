import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { JsonLd } from '@/components/seo/JsonLd';
import { normalizeLocale } from '@/lib/i18n';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { ToastViewport } from '@/components/shared/Toasts';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_TITLE,
  SITE_NAME,
  absoluteAssetUrl,
  absoluteUrl,
  getSiteUrl,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#86000c',
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: '/images/el-padel-logo-mark.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ka_GE'],
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: absoluteUrl('/'),
    images: [{ url: absoluteAssetUrl(DEFAULT_OG_IMAGE_PATH), alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [absoluteAssetUrl(DEFAULT_OG_IMAGE_PATH)],
  },
  robots: {
    index: true,
    follow: true,
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
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <I18nProvider initialLocale={initialLocale}>
          {children}
          <LegalFooter />
          <ToastViewport />
        </I18nProvider>
      </body>
    </html>
  );
}
