import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Create Account — El Padel',
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : user.role === 'JUDGE' ? '/judge' : '/dashboard');

  return (
    <AuthShell variant="register">
      <RegisterForm oauthError={(await searchParams).error} />
    </AuthShell>
  );
}
