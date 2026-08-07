import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Log In — El Padel',
  description: 'Sign in to your El Padel Tournament Tbilisi account.',
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reset?: string;
  }>;
};

function safeNextPath(value?: string) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' || user.role === 'ORGANISER' ? '/admin' : user.role === 'JUDGE' ? '/' : '/dashboard');
  const nextPath = safeNextPath(params.next);

  return (
    <AuthShell variant="login">
      <LoginForm nextPath={nextPath} oauthError={params.error} passwordWasReset={params.reset === 'done'} />
    </AuthShell>
  );
}
