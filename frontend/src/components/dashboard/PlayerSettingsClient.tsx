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
      <AccountSettings user={initialUser} danger={copy} />
    </PlayerShell>
  );
}
