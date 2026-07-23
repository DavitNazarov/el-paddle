import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { JsonLd } from '@/components/seo/JsonLd';
import { legalDocumentSlugs, legalDocuments, type LegalDocumentSlug } from '@/lib/legal';
import { breadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';

type PageProps = { params: Promise<{ document: string }> };

export function generateStaticParams() {
  return legalDocumentSlugs.map((document) => ({ document }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { document } = await params;
  if (!legalDocumentSlugs.includes(document as LegalDocumentSlug)) return {};
  const item = legalDocuments[document as LegalDocumentSlug];
  return buildPageMetadata({
    title: `${item.title.en} | El Padel`,
    description: item.summary.en,
    path: `/legal/${document}`,
  });
}

export default async function LegalPage({ params }: PageProps) {
  const { document } = await params;
  if (!legalDocumentSlugs.includes(document as LegalDocumentSlug)) notFound();
  const item = legalDocuments[document as LegalDocumentSlug];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: item.title.en, path: `/legal/${document}` },
        ])}
      />
      <LegalDocumentPage slug={document as LegalDocumentSlug} />
    </>
  );
}
