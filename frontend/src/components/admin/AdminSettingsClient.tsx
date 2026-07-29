'use client';

import { AccountSettings } from '@/components/shared/account/AccountSettings';
import { useI18n } from '@/components/shared/I18nProvider';
import { AdminShell } from '@/components/admin/AdminShell';
import type { PublicUser } from '@/types/auth';

export function AdminSettingsClient({ user }: { user: PublicUser }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.admin.settingsPage;
  const isAdmin = user.role === 'ADMIN';
  // Organisers share this screen but not the "last admin" caveat in its copy.
  const danger = isAdmin ? copy : dictionary.dashboard.account.danger;
  const description = isAdmin ? copy.description : copy.organiserDescription;

  return (
    <AdminShell title={copy.title} description={description} eyebrow={copy.eyebrow}>
      <AccountSettings user={user} danger={danger} />
    </AdminShell>
  );
}
