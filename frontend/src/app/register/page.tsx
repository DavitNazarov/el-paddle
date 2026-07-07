import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/padel/AuthShell';
import { RegisterForm } from '@/components/padel/RegisterForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Create Account — El Padel',
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <AuthShell
      kicker="Player registration"
      title="Create your El Padel account."
      copy="Use your verified email, name and surname. Team registrations are linked by teammate email and reviewed by the admin."
    >
      <RegisterForm />
    </AuthShell>
  );
}
