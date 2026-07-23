import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { InviteForm, MissingInviteToken } from '@/components/auth/InviteForm';

export const metadata: Metadata = {
  title: 'Teammate Invite — El Padel',
  description: 'Accept a teammate invitation for an El Padel tournament entry.',
  robots: { index: false, follow: false },
};

type InvitePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = await searchParams;

  return (
    <AuthShell variant="invite">
      {params.token ? <InviteForm token={params.token} /> : <MissingInviteToken />}
    </AuthShell>
  );
}
