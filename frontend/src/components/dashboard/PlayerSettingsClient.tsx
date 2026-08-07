'use client';

import { AccountSettings } from '@/components/shared/account/AccountSettings';
import { useI18n } from '@/components/shared/I18nProvider';
import { PlayerShell } from '@/components/dashboard/PlayerShell';
import type { PublicUser } from '@/types/auth';

type PlayerSettingsClientProps = {
  initialUser: PublicUser;
};

export function PlayerSettingsClient({ initialUser }: PlayerSettingsClientProps) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.settingsPage;

  return (
    <PlayerShell
      title={copy.title}
      description={copy.description}
      eyebrow={copy.eyebrow}
      user={initialUser}
    >
      {/* The profile has a page of its own in the sidebar, so settings keeps
          only what is left: security, preferences, and deletion. */}
      <AccountSettings user={initialUser} danger={copy} includeProfile={false} />
    </PlayerShell>
  );
}
