'use client';

import { useState } from 'react';
import { LoaderCircle, LogOut } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DashboardField,
  DashboardModal,
  formControlClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch, createCommandId, readApiJson } from '@/lib/api';
import type { RegistrationDto } from '@/types/dashboard';

/**
 * Pulling a club team out of an event.
 *
 * Withdrawing is destructive and one-way — a withdrawn entry has no transition
 * back — so it asks in a dialog rather than offering a button that acts on the
 * first press, states which team leaves which event by name, and puts the
 * consequence next to the confirm rather than in a tooltip.
 *
 * The reason is optional because the club owes nobody an explanation, but it is
 * offered because the organiser reading the entry list is the one who has to
 * decide whether to backfill the place.
 */
export function EntryWithdrawDialog({
  registration,
  onClose,
  onWithdrawn,
  onConflict,
}: {
  registration: RegistrationDto;
  onClose: () => void;
  onWithdrawn: () => Promise<void> | void;
  onConflict?: () => Promise<void> | void;
}) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.withdrawEntry;
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function withdraw() {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/registrations/${registration.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          expectedVersion: registration.version,
          commandId: createCommandId(`registration-withdraw:${registration.id}`),
        }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        // The server's own reason is always the better message: it knows
        // whether the draw is locked or the event has started.
        setError(data.error ?? copy.error);
        if (response.status === 409) await onConflict?.();
        return;
      }
      await onWithdrawn();
    } catch {
      setError(copy.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardModal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={copy.title}
      description={copy.description}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={modalSoftButtonClassName}
            disabled={saving}
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="red" disabled={saving} onClick={withdraw}>
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? copy.saving : copy.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5">
          <p className="text-sm font-semibold text-[#3b302e]">{registration.event.title}</p>
          <p className="mt-0.5 text-sm text-[#6d5f5c]">
            {registration.category.name} · {registration.owner.fullName} / {registration.teammate.fullName}
          </p>
        </div>
        <DashboardField id="withdraw-reason" label={copy.reasonLabel} hint={copy.reasonHint}>
          <input
            id="withdraw-reason"
            type="text"
            value={reason}
            maxLength={200}
            disabled={saving}
            className={formControlClassName}
            placeholder={copy.reasonPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
        </DashboardField>
        <p className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5 text-sm leading-6 text-[#6d5f5c]">
          {copy.consequence}
        </p>
      </div>
    </DashboardModal>
  );
}
