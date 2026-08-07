'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, createCommandId } from '@/lib/api';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { InlineNotice } from '@/components/tournament/TournamentUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/shared/I18nProvider';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import type { RegistrationDto } from '@/types/dashboard';

type EligibleEntry = { id: string; owner: { fullName: string }; teammate: { fullName: string } };

type OpponentRequestModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  approvedEntries: RegistrationDto[];
  onSent?: () => void;
};

/**
 * The same opponent-request form players use on the event page, reusable from
 * the home hero so an approved entry can send a request without opening the
 * full event workspace first.
 */
export function OpponentRequestModal({
  open,
  onOpenChange,
  eventId,
  approvedEntries,
  onSent,
}: OpponentRequestModalProps) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;

  // Opening the dialog clears it during render rather than in an effect, so the
  // previous request's selection never paints for a frame first.
  const defaultEntryId = approvedEntries[0]?.id ?? '';
  const [eligible, setEligible] = useResetOnOpen<EligibleEntry[]>(open, []);
  const [eligibleLoadedFor, setEligibleLoadedFor] = useResetOnOpen(open, '');
  const [form, setForm] = useResetOnOpen(open, { requestingEntryId: defaultEntryId, targetEntryId: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useResetOnOpen(open, '');

  const fetchEligible = useCallback(async (entryId: string) => {
    setError('');
    const response = await apiFetch(
      `/api/events/${eventId}/eligible-opponents?requestingEntryId=${encodeURIComponent(entryId)}`,
      { cache: 'no-store' },
    );
    const data = (await response.json()) as { entries?: EligibleEntry[]; error?: string };
    setEligibleLoadedFor(entryId);
    if (!response.ok) setError(data.error ?? player.choicesUnavailable);
    else setEligible(data.entries ?? []);
    // The setters come from `useResetOnOpen`, so the linter cannot see that they
    // are plain useState setters and therefore already stable. Listing them is
    // free and keeps the rule meaningful here.
  }, [eventId, player.choicesUnavailable, setEligible, setEligibleLoadedFor, setError]);

  // Clearing is handled above during render; the effect is left with the one
  // thing that genuinely belongs in it — talking to the server.
  useEffect(() => {
    if (!open || !defaultEntryId) return;
    void fetchEligible(defaultEntryId);
  }, [open, defaultEntryId, fetchEligible]);

  const eligibleLoading = Boolean(form.requestingEntryId && eligibleLoadedFor !== form.requestingEntryId);

  function selectEntry(entryId: string) {
    setForm((current) => ({ ...current, requestingEntryId: entryId, targetEntryId: '' }));
    setEligible([]);
    setEligibleLoadedFor('');
    if (entryId) void fetchEligible(entryId);
  }

  async function sendRequest() {
    if (!form.requestingEntryId || !form.targetEntryId) return;
    setBusy(true);
    setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests`, {
      method: 'POST',
      body: JSON.stringify({ ...form, commandId: createCommandId('opponent-request') }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? player.sendError);
      return;
    }
    onOpenChange(false);
    onSent?.();
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={player.chooseOpponent}
      description={player.modalDescription}
      footer={
        <ModalFormFooter
          formId="opponent-request-form"
          onCancel={() => onOpenChange(false)}
          cancelLabel={copy.common.cancel}
          busy={busy}
          disabled={!form.requestingEntryId || !form.targetEntryId || eligibleLoading}
          submitLabel={busy ? player.sending : player.send}
        />
      }
    >
      <form
        id="opponent-request-form"
        className="grid gap-5"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          void sendRequest();
        }}
      >
        {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
        <DashboardField id="own-entry" label={player.competitionEntry}>
          <select
            id="own-entry"
            className={selectControlClassName}
            value={form.requestingEntryId}
            onChange={(fieldEvent) => selectEntry(fieldEvent.target.value)}
            disabled={busy}
          >
            <option value="">{player.selectEntry}</option>
            {approvedEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.owner.fullName} / {entry.teammate.fullName} · {entry.category.name}
              </option>
            ))}
          </select>
        </DashboardField>
        <DashboardField id="opponent-entry" label={player.eligibleOpponent} hint={player.eligibleHint}>
          <select
            id="opponent-entry"
            className={selectControlClassName}
            value={form.targetEntryId}
            onChange={(fieldEvent) => setForm((current) => ({ ...current, targetEntryId: fieldEvent.target.value }))}
            disabled={!form.requestingEntryId || eligibleLoading || busy}
            aria-busy={eligibleLoading}
          >
            <option value="">
              {eligible.length ? player.selectOpponent : eligibleLoading ? player.loadingOpponents : player.noOpponents}
            </option>
            {eligible.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.owner.fullName} / {entry.teammate.fullName}
              </option>
            ))}
          </select>
        </DashboardField>
        <DashboardField id="request-message" label={player.message} hint={player.messageHint}>
          <Textarea
            id="request-message"
            value={form.message}
            onChange={(fieldEvent) => setForm((current) => ({ ...current, message: fieldEvent.target.value }))}
            placeholder={player.messagePlaceholder}
            className={cn(formControlClassName, 'min-h-28 resize-y leading-6')}
            disabled={busy}
            rows={4}
          />
        </DashboardField>
      </form>
    </DashboardModal>
  );
}
