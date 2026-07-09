import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { CompleteClubForm } from '@/components/auth/CompleteClubForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Create Club — El Padel',
};

export default async function CompleteClubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/complete-club');
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.club) redirect('/dashboard');

  return (
    <AuthShell variant="completeClub">
      <CompleteClubForm />
    </AuthShell>
  );
}
