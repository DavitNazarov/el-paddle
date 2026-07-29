import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { noIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  ...noIndexMetadata,
};

export default async function JudgeLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/judge');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role !== 'JUDGE' && user.role !== 'ORGANISER') redirect('/dashboard');
  return children;
}
