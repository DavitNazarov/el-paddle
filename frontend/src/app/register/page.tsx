import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Create Account — El Padel',
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <AuthShell variant="register">
      <RegisterForm />
    </AuthShell>
  );
}
