import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/PasswordResetForms';

export const metadata: Metadata = {
  title: 'Reset Password — El Padel',
  description: 'Request a link to choose a new El Padel password.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="resetPassword">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
