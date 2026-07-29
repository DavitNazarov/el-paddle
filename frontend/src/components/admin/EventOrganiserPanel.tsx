'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { CommandButton, InlineNotice, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import { useViewer } from '@/hooks/useViewer';
import { tournamentCopy } from '@/lib/i18n/tournament';

type Organiser = {
  id: string;
  name: string | null;
  surname: string | null;
  email: string;
  assignedAt?: string;
};

function organiserLabel(organiser: Organiser) {
  return [organiser.name, organiser.surname].filter(Boolean).join(' ') || organiser.email;
}

/**
 * Hand an event to an organiser. Assigning power stays an admin act, so an
 * organiser viewing this panel sees who is running the event but no controls.
 */
export function EventOrganiserPanel({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.organisers;
  const { viewer } = useViewer();
  const isAdmin = viewer?.role === 'ADMIN';

  const [assigned, setAssigned] = useState<Organiser[]>([]);
  const [candidates, setCandidates] = useState<Organiser[]>([]);
  const [selected, setSelected] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/admin/events/${eventId}/organisers`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { organisers?: Organiser[] };
    setAssigned(data.organisers ?? []);
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openModal() {
    setError('');
    setSelected('');
    setModalOpen(true);
    const response = await apiFetch('/api/admin/organisers', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { organisers?: Organiser[] };
    setCandidates(data.organisers ?? []);
  }

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/organisers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: selected }),
    });
    const data = (await response.json()) as { organisers?: Organiser[]; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? copy.assignError);
      return;
    }
    setAssigned(data.organisers ?? []);
    setModalOpen(false);
  }

  async function revoke(userId: string) {
    setBusy(true);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/organisers/${userId}`, { method: 'DELETE' });
    const data = (await response.json()) as { organisers?: Organiser[]; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? copy.revokeError);
      return;
    }
    setAssigned(data.organisers ?? []);
  }

  const unassigned = candidates.filter((candidate) => !assigned.some((item) => item.id === candidate.id));

  return (
    <TournamentPanel>
      <TournamentSectionHeader
        title={copy.title}
        description={copy.description}
        actions={isAdmin ? (
          <CommandButton tone="primary" busy={busy} onClick={() => void openModal()}>
            <UserCog className="h-4 w-4" />
            {copy.sendToOrganiser}
          </CommandButton>
        ) : undefined}
      />
      <div className="px-5 py-4">
        {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
        {assigned.length ? (
          <ul className="grid gap-2">
            {assigned.map((organiser) => (
              <li key={organiser.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[rgba(213,201,177,0.75)]">
                <span>
                  {organiserLabel(organiser)}
                  <span className="text-[rgba(213,201,177,0.45)]"> · {organiser.email}</span>
                </span>
                {isAdmin ? (
                  <CommandButton tone="danger" busy={busy} onClick={() => void revoke(organiser.id)}>
                    {copy.revoke}
                  </CommandButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-[rgba(213,201,177,0.55)]">{copy.none}</p>
        )}
      </div>

      <DashboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={copy.modalTitle}
        description={copy.modalDescription}
        footer={
          <ModalFormFooter
            formId="assign-organiser-form"
            onCancel={() => setModalOpen(false)}
            cancelLabel={tournamentCopy[locale].common.cancel}
            busy={busy}
            submitLabel={busy ? copy.assigning : copy.assign}
          />
        }
      >
        <form id="assign-organiser-form" onSubmit={assign} className="grid gap-3">
          <label className="text-sm font-semibold text-[rgba(213,201,177,0.75)]" htmlFor="organiser-select">
            {copy.pickOrganiser}
          </label>
          <select
            id="organiser-select"
            required
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="min-h-11 rounded-md border border-[rgba(213,201,177,0.18)] bg-[rgba(20,18,16,0.6)] px-3 text-sm text-[var(--padel-ivory)]"
          >
            <option value="">{copy.pickOrganiser}</option>
            {unassigned.map((organiser) => (
              <option key={organiser.id} value={organiser.id}>
                {organiserLabel(organiser)} — {organiser.email}
              </option>
            ))}
          </select>
          {!unassigned.length ? <InlineNotice>{copy.noCandidates}</InlineNotice> : null}
        </form>
      </DashboardModal>
    </TournamentPanel>
  );
}
