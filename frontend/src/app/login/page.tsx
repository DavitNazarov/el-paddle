import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/padel/AuthShell';
import { LoginForm } from '@/components/padel/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Log In — El Padel',
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');
  const nextPath = params.next?.startsWith('/') ? params.next : '/dashboard';

  return (
    <AuthShell
      kicker="Player access"
      title="Log in to your tournament dashboard."
      copy="See upcoming events, team entries, admin decisions, club membership and your match record."
    >
      <LoginForm nextPath={nextPath} oauthError={params.error} />
    </AuthShell>
  );
}
