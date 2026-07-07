import type { Metadata } from 'next';
import { AuthShell } from '@/components/padel/AuthShell';
import { InviteForm } from '@/components/padel/InviteForm';

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
    <AuthShell
      kicker="Teammate invite"
      title="Finish your teammate profile."
      copy="Your teammate added you to an event registration. Create a password to log in and follow the registration status."
    >
      {params.token ? (
        <InviteForm token={params.token} />
      ) : (
        <p className="text-sm text-[var(--padel-ink)]/70">Invite token is missing.</p>
      )}
    </AuthShell>
  );
}
