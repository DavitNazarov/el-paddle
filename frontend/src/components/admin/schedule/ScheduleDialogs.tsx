'use client';

import type { CourtDto, MatchDto } from '@/types/tournament';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/shared/I18nProvider';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { isQueueFinished, matchTitle, type CategoryNamer } from './scheduleModel';

/**
 * The three schedule forms. Each owns its own fields and resets when it opens,
 * so the board itself holds no half-typed state.
 */

export type MatchSelection = { courtId: string; matchId: string; plannedStartAt: string };

const emptySelection: MatchSelection = { courtId: '', matchId: '', plannedStartAt: '' };

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

export function AddMatchDialog({
  open,
  onOpenChange,
  busy,
  categoryOf,
  courts,
  matches,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  categoryOf: CategoryNamer;
  courts: CourtDto[];
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
          // Match numbers restart per draw, so an option has to say which draw.
          options={matches.map((match) => {
            const category = categoryOf(match);
            const title = matchTitle(locale, match);
            return { value: match.id, label: category ? `${category} · ${title}` : title };
          })}
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
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
        <option value="">{fillTemplate(copy.select, { label: label.toLowerCase() })}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
