'use client';

import { AccountSettings } from '@/components/shared/account/AccountSettings';
import { PlayerShell } from '@/components/dashboard/PlayerShell';
import { useI18n } from '@/components/shared/I18nProvider';
import type { PublicUser } from '@/types/auth';

const user: PublicUser = {
  id: 'preview',
  email: 'nino.beridze@example.com',
  name: 'Nino',
  surname: 'Beridze',
  fullName: 'Nino Beridze',
  phone: '+995 599 11 22 33',
  role: 'USER',
  status: 'ACTIVE',
  isVerified: true,
  disqualifiedUntil: null,
  disqualificationReason: '',
  isDisqualified: false,
  club: { id: 'c1', name: 'Turtle Lake Padel', slug: 'turtle-lake' },
  stats: { matchesPlayed: 12, wins: 8, losses: 4 },
  organiserEventIds: [],
};

export function AccountSettingsPreview() {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.settingsPage;
  return (
    <PlayerShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow} user={user}>
      <AccountSettings user={user} danger={copy} />
    </PlayerShell>
  );
}
