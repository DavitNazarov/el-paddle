import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocumentSlugs, legalDocuments, type LegalDocumentSlug } from '@/lib/legal';

type PageProps = { params: Promise<{ document: string }> };

export function generateStaticParams() {
  return legalDocumentSlugs.map((document) => ({ document }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { document } = await params;
  if (!legalDocumentSlugs.includes(document as LegalDocumentSlug)) return {};
  const item = legalDocuments[document as LegalDocumentSlug];
  return { title: `${item.title.en} | El Padel`, description: item.summary.en };
}

export default async function LegalPage({ params }: PageProps) {
  const { document } = await params;
  if (!legalDocumentSlugs.includes(document as LegalDocumentSlug)) notFound();
  return <LegalDocumentPage slug={document as LegalDocumentSlug} />;
}
