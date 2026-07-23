import type { Metadata } from 'next';
import { PadelHome } from '@/components/padel/PadelHome';
import { buildPageMetadata, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: '/',
});

export default function Home() {
  return <PadelHome />;
}
