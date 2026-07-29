'use client';

import { AccountSettings } from '@/components/shared/account/AccountSettings';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { PublicUser } from '@/types/auth';
import { JudgeShell } from './JudgeShell';

export function JudgeSettingsClient({ user }: { user: PublicUser }) {
  const { dictionary, locale } = useI18n();
  const copy = tournamentCopy[locale].judge.settings;

  return (
    <JudgeShell user={user} title={copy.title} description={copy.description}>
      <AccountSettings user={user} danger={dictionary.dashboard.account.danger} />
    </JudgeShell>
  );
}
