import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { MissingResetToken, ResetPasswordForm } from '@/components/auth/PasswordResetForms';

export const metadata: Metadata = {
  title: 'Choose a New Password — El Padel',
  description: 'Set a new password for your El Padel account.',
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell variant="resetPassword">
      {params.token ? <ResetPasswordForm token={params.token} /> : <MissingResetToken />}
    </AuthShell>
  );
}
