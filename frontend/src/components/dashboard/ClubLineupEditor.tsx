'use client';

import { useState } from 'react';
import { ArrowRightLeft, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DashboardField,
  DashboardModal,
  modalSoftButtonClassName,
  selectControlClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch, createCommandId, readApiJson } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import type { RegistrationDto } from '@/types/dashboard';

type ClubLineupEditorProps = {
  registration: RegistrationDto;
  clubPlayers: PublicUser[];
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
  onConflict?: () => Promise<void> | void;
};

export function ClubLineupEditor({
  registration,
  clubPlayers,
  onClose,
  onUpdated,
  onConflict,
}: ClubLineupEditorProps) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.clubEntries;
  const candidates = clubPlayers.filter(
    (member) => member.id !== registration.owner.id && member.id !== registration.teammate.id,
  );
  const [replacementSlot, setReplacementSlot] = useState<'owner' | 'teammate'>('teammate');
  const [replacementUserId, setReplacementUserId] = useState(candidates[0]?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function replacePlayer() {
    if (!replacementUserId) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/registrations/${registration.id}/lineup`, {
        method: 'PATCH',
        body: JSON.stringify({
          slot: replacementSlot,
          replacementUserId,
          expectedVersion: registration.version,
          commandId: createCommandId(`registration-lineup:${registration.id}`),
        }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.error);
        if (response.status === 409) await onConflict?.();
        return;
      }
      await onUpdated();
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
      title={copy.modalTitle}
      description={copy.modalDescription}
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
          <Button
            type="button"
            variant="red"
            disabled={saving || !replacementUserId}
            onClick={replacePlayer}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? copy.saving : copy.save}
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
        <DashboardField id="replacement-slot" label={copy.playerToReplace}>
          <select
            id="replacement-slot"
            value={replacementSlot}
            disabled={saving}
            className={selectControlClassName}
            onChange={(event) => setReplacementSlot(event.target.value as 'owner' | 'teammate')}
          >
            <option value="owner">{registration.owner.fullName}</option>
            <option value="teammate">{registration.teammate.fullName}</option>
          </select>
        </DashboardField>
        <DashboardField id="replacement-player" label={copy.replacementPlayer}>
          <select
            id="replacement-player"
            value={replacementUserId}
            disabled={saving || candidates.length === 0}
            className={selectControlClassName}
            onChange={(event) => setReplacementUserId(event.target.value)}
          >
            {candidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </DashboardField>
        {!candidates.length ? <p className="text-sm text-[#9f302b]">{copy.noCandidates}</p> : null}
        <p className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5 text-sm leading-6 text-[#6d5f5c]">
          {copy.statusReset}
        </p>
      </div>
    </DashboardModal>
  );
}
