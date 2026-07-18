'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DashboardModal,
  FeedbackBanner,
  SectionHeading,
  SurfaceCard,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { apiFetch } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';

export function AdminSettingsClient() {
  const router = useRouter();
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.admin.settingsPage;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setError('');
    setBusy(true);
    const response = await apiFetch('/api/account', { method: 'DELETE' });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? copy.deleteFailed);
      return;
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={copy.dangerTitle} description={copy.dangerDescription} />
      <SurfaceCard className="mt-4">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-[var(--padel-ivory)]">
              {copy.deleteTitle}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[rgba(213,201,177,0.55)]">
              {copy.deleteWarning}
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-md border-[var(--padel-red)]/35 bg-transparent text-[var(--padel-red)]"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {copy.deleteButton}
          </Button>
        </div>
      </SurfaceCard>

      <DashboardModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={copy.confirmTitle}
        description={copy.confirmDescription}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setConfirmOpen(false)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitType="button"
            onSubmitClick={() => {
              void deleteAccount();
            }}
            submitLabel={busy ? copy.deleting : copy.confirmDelete}
          />
        }
      >
        <p className="text-sm leading-6 text-[#60748b]">{copy.deleteWarning}</p>
      </DashboardModal>
    </AdminShell>
  );
}
