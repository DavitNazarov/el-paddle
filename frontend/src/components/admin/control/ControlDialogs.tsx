'use client';

import type { MatchDto } from '@/types/tournament';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { Input } from '@/components/ui/input';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { SIDES, pairName, participantOf, type Side } from './matchModel';

export type FinishForm = {
  side: Side;
  resultType: 'WALKOVER' | 'WITHDRAWAL';
  reason: string;
};

const emptyForm: FinishForm = { side: 'A', resultType: 'WALKOVER', reason: '' };

/**
 * Finishing a match that was never played out: a no-show or a retirement. The
 * normal path is recording sets, so this asks for a reason and is deliberately
 * a separate, slower control rather than a button beside the set buttons.
 */
export function FinishMatchDialog({
  busy,
  match,
  onOpenChange,
  onSubmit,
}: {
  busy: boolean;
  match: MatchDto | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FinishForm) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const [form, setForm] = useResetOnOpen(Boolean(match), emptyForm);

  const complete = form.reason.trim().length > 0;

  return (
    <DashboardModal
      open={Boolean(match)}
      onOpenChange={(open) => { if (!open && !busy) onOpenChange(false); }}
      title={control.finishTitle}
      description={control.finishDescription}
      size="md"
      footer={(
        <ModalFormFooter
          formId="finish-match-form"
          onCancel={() => onOpenChange(false)}
          cancelLabel={copy.common.cancel}
          busy={busy}
          disabled={!complete}
          submitLabel={busy ? control.finishing : control.finishSubmit}
        />
      )}
    >
      {match ? (
        <form
          id="finish-match-form"
          className="space-y-4"
          onSubmit={(formEvent) => { formEvent.preventDefault(); onSubmit(form); }}
        >
          <DashboardField label={control.finishWinner} id="finish-side">
            <select
              id="finish-side"
              className={`${selectControlClassName} h-11 bg-white`}
              value={form.side}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, side: fieldEvent.target.value as Side }))}
            >
              {SIDES.map((side) => (
                <option key={side} value={side}>
                  {side} — {pairName(participantOf(match, side), copy.common.tbd)}
                </option>
              ))}
            </select>
          </DashboardField>

          <DashboardField label={control.finishType} id="finish-type">
            <select
              id="finish-type"
              className={`${selectControlClassName} h-11 bg-white`}
              value={form.resultType}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, resultType: fieldEvent.target.value as FinishForm['resultType'] }))}
            >
              <option value="WALKOVER">{control.finishWalkover}</option>
              <option value="WITHDRAWAL">{control.finishWithdrawal}</option>
            </select>
          </DashboardField>

          <DashboardField label={control.finishReason} id="finish-reason" hint={control.finishReasonHint}>
            <Input
              id="finish-reason"
              required
              value={form.reason}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, reason: fieldEvent.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      ) : null}
    </DashboardModal>
  );
}
