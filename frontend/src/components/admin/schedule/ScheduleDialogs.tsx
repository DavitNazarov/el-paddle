'use client';

import { useState } from 'react';
import type { CourtDto, MatchDto } from '@/types/tournament';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { isQueueFinished, judgeName, matchTitle, type EventJudge } from './scheduleModel';

/**
 * The three schedule forms. Each owns its own fields and resets when it opens,
 * so the board itself holds no half-typed state.
 */

export type JudgeForm = { email: string; name: string; surname: string };
export type MatchSelection = { courtId: string; matchId: string; judgeId: string; plannedStartAt: string };

const emptyJudge: JudgeForm = { email: '', name: '', surname: '' };
const emptySelection: MatchSelection = { courtId: '', matchId: '', judgeId: '', plannedStartAt: '' };

/**
 * Clears a dialog's fields each time it is opened, by adjusting state during
 * render rather than in an effect — the dialog must not paint the previous
 * entry's values for a frame before resetting them.
 */
function useResetOnOpen<T>(open: boolean, initial: T) {
  const [value, setValue] = useState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(initial);
  }
  return [value, setValue] as const;
}

export function CreateCourtDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (name: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [name, setName] = useResetOnOpen(open, '');

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.admin.schedule.createCourt}
      description={copy.admin.schedule.createCourtDescription}
      size="md"
      footer={(
        <ModalFormFooter
          formId="create-court-form"
          onCancel={() => onOpenChange(false)}
          cancelLabel={copy.common.cancel}
          busy={busy}
          disabled={!name.trim()}
          submitLabel={busy ? copy.admin.schedule.creating : copy.admin.schedule.createCourt}
        />
      )}
    >
      <form id="create-court-form" onSubmit={(formEvent) => { formEvent.preventDefault(); onSubmit(name); }}>
        <DashboardField label={copy.admin.schedule.courtName} id="court-name">
          <Input
            id="court-name"
            autoFocus
            required
            value={name}
            onChange={(fieldEvent) => setName(fieldEvent.target.value)}
            placeholder={copy.admin.schedule.courtPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
      </form>
    </DashboardModal>
  );
}

export function AddJudgeDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (form: JudgeForm) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [form, setForm] = useResetOnOpen(open, emptyJudge);
  const complete = form.email.trim() && form.name.trim() && form.surname.trim();

  const field = (key: keyof JudgeForm) => (fieldEvent: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: fieldEvent.target.value }));

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.admin.judges.addTitle}
      description={copy.admin.judges.addDescription}
      size="md"
      footer={(
        <ModalFormFooter
          formId="add-judge-form"
          onCancel={() => onOpenChange(false)}
          cancelLabel={copy.common.cancel}
          busy={busy}
          disabled={!complete}
          submitLabel={busy ? copy.admin.judges.adding : copy.admin.judges.add}
        />
      )}
    >
      <form id="add-judge-form" className="space-y-4" onSubmit={(formEvent) => { formEvent.preventDefault(); onSubmit(form); }}>
        <DashboardField label={copy.admin.judges.email} id="judge-email">
          <Input id="judge-email" autoFocus required type="email" value={form.email} onChange={field('email')} className={formControlClassName} />
        </DashboardField>
        <DashboardField label={copy.admin.judges.firstName} id="judge-name">
          <Input id="judge-name" required value={form.name} onChange={field('name')} className={formControlClassName} />
        </DashboardField>
        <DashboardField label={copy.admin.judges.lastName} id="judge-surname">
          <Input id="judge-surname" required value={form.surname} onChange={field('surname')} className={formControlClassName} />
        </DashboardField>
      </form>
    </DashboardModal>
  );
}

export function AddMatchDialog({
  open,
  onOpenChange,
  busy,
  courts,
  judges,
  matches,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  courts: CourtDto[];
  judges: EventJudge[];
  matches: MatchDto[];
  onSubmit: (selection: MatchSelection) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const schedule = copy.admin.schedule;
  const [selection, setSelection] = useResetOnOpen(open, emptySelection);
  const openCourts = courts.filter((court) => !isQueueFinished(court));

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={schedule.addMatch}
      description={schedule.addMatchDescription}
      size="lg"
      footer={(
        <ModalFormFooter
          formId="add-match-form"
          onCancel={() => onOpenChange(false)}
          cancelLabel={copy.common.cancel}
          busy={busy}
          disabled={!selection.courtId || !selection.matchId}
          submitLabel={busy ? schedule.adding : schedule.addToQueue}
        />
      )}
    >
      <form id="add-match-form" className="space-y-4" onSubmit={(formEvent) => { formEvent.preventDefault(); onSubmit(selection); }}>
        <FieldSelect
          label={schedule.court}
          disabled={!openCourts.length}
          value={selection.courtId}
          onChange={(value) => setSelection((current) => ({ ...current, courtId: value }))}
          options={openCourts.map((court) => ({ value: court.id, label: court.name }))}
        />
        <FieldSelect
          label={schedule.match}
          disabled={!matches.length}
          value={selection.matchId}
          onChange={(value) => setSelection((current) => ({ ...current, matchId: value }))}
          options={matches.map((match) => ({ value: match.id, label: matchTitle(locale, match) }))}
        />
        <FieldSelect
          label={schedule.judge}
          value={selection.judgeId}
          onChange={(value) => setSelection((current) => ({ ...current, judgeId: value }))}
          options={judges.map((judge) => ({ value: judge.id, label: judgeName(judge) }))}
          optional
        />
        <DashboardField label={schedule.plannedStart} id="planned-start" hint={schedule.optional}>
          <Input
            id="planned-start"
            className={formControlClassName}
            type="datetime-local"
            value={selection.plannedStartAt}
            onChange={(fieldEvent) => setSelection((current) => ({ ...current, plannedStartAt: fieldEvent.target.value }))}
          />
        </DashboardField>
      </form>
    </DashboardModal>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  optional = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const id = label.toLowerCase().replaceAll(' ', '-');
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        disabled={disabled}
        className={`${selectControlClassName} mt-2 bg-white`}
        value={value}
        onChange={(fieldEvent) => onChange(fieldEvent.target.value)}
      >
        <option value="">{optional ? copy.notAssigned : fillTemplate(copy.select, { label: label.toLowerCase() })}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
