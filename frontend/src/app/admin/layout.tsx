import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { noIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  ...noIndexMetadata,
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN' && user.role !== 'ORGANISER') redirect('/dashboard');

  return children;
}
