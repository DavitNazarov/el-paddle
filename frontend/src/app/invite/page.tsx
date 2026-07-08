import type { Metadata } from 'next';
import { AuthShell } from '@/components/padel/AuthShell';
import { InviteForm, MissingInviteToken } from '@/components/padel/InviteForm';

export const metadata: Metadata = {
  title: 'Teammate Invite — El Padel',
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
