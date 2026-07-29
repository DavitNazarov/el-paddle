import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { ApplicationStatus } from '@/components/auth/ApplicationStatus';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Club Request Status — El Padel',
  description: 'Check whether an administrator has reviewed your El Padel club request.',
  robots: { index: false, follow: false },
};

export default async function RegisterStatusPage() {
  const user = await getCurrentUser();
  // An approved applicant has a real account and no request left to track.
  if (user) redirect(user.role === 'ADMIN' || user.role === 'ORGANISER' ? '/admin' : user.role === 'JUDGE' ? '/judge' : '/dashboard');

  return (
    <AuthShell variant="register">
      <ApplicationStatus />
    </AuthShell>
  );
}
