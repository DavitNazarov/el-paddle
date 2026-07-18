import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/judge');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role !== 'JUDGE') redirect('/dashboard');
  return children;
}

