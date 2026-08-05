'use client';

import type { ReactNode } from 'react';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { FormStepper, type FormStepView } from '@/components/shared/dashboard/FormStepper';
import { Notice } from '@/components/shared/dashboard/Feedback';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import styles from './Directory.module.css';

/**
 * The create/edit modal every directory uses. One shape for all four screens:
 * grouped fields, an explicit save, and any failure shown *inside* the modal
 * next to the fields that caused it — a banner behind a modal the reader cannot
 * see is the same as no error at all.
 */
export function EditorModal({
  open,
  onOpenChange,
  title,
  description,
  formId,
  busy,
  error,
  cancelLabel,
  submitLabel,
  size = 'lg',
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  formId: string;
  busy: boolean;
  /** Shown inside the modal; the caller clears it when reopening. */
  error?: string;
  cancelLabel: string;
  submitLabel: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      size={size}
      footer={
        <ModalFormFooter
          formId={formId}
          onCancel={() => onOpenChange(false)}
          cancelLabel={cancelLabel}
          busy={busy}
          submitLabel={submitLabel}
        />
      }
    >
      <form
        id={formId}
        className={styles.formGrid}
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          onSubmit();
        }}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        {children}
      </form>
    </DashboardModal>
  );
}

/**
 * The stepped variant of `EditorModal`, for a form long enough that showing all
 * of it at once buries the question being asked. The rail stays navigable, so
 * this is `EditorModal` with a smaller viewport onto the same form — not a gate
 * that has to be argued past. Enter and the primary button mean “continue”
 * until the last step, where they mean save.
 */
export function StepperEditorModal({
  open,
  onOpenChange,
  title,
  description,
  formId,
  busy,
  error,
  steps,
  current,
  onStepChange,
  stepperLabel,
  progressLabel,
  stepStatusLabels,
  cancelLabel,
  backLabel,
  nextLabel,
  submitLabel,
  size = 'lg',
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  formId: string;
  busy: boolean;
  error?: string;
  steps: FormStepView[];
  current: number;
  onStepChange: (index: number) => void;
  stepperLabel: string;
  /** Already filled, e.g. “Step 2 of 4”. */
  progressLabel: string;
  stepStatusLabels: { done: string; invalid: string };
  cancelLabel: string;
  backLabel: string;
  nextLabel: ReactNode;
  submitLabel: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  onSubmit: () => void;
  children: ReactNode;
}) {
  const isFirst = current <= 0;
  const isLast = current >= steps.length - 1;

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      size={size}
      footer={
        <ModalFormFooter
          formId={formId}
          onCancel={() => (isFirst ? onOpenChange(false) : onStepChange(current - 1))}
          cancelLabel={isFirst ? cancelLabel : backLabel}
          busy={busy}
          submitLabel={isLast ? submitLabel : nextLabel}
        />
      }
    >
      <form
        id={formId}
        className={styles.formGrid}
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          // One submit button for two jobs: pressing Enter in a field has to
          // move to the next step, not save a half-answered form.
          if (isLast) onSubmit();
          else onStepChange(current + 1);
        }}
      >
        <FormStepper
          steps={steps}
          label={stepperLabel}
          progress={progressLabel}
          statusLabels={stepStatusLabels}
          onSelect={onStepChange}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        {children}
      </form>
    </DashboardModal>
  );
}

/**
 * Destructive confirmation. Separate from `EditorModal` because it has no fields
 * to group and its primary action has to read as a consequence, not a save.
 */
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  body,
  busy,
  error,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  body: ReactNode;
  busy: boolean;
  error?: string;
  cancelLabel: string;
  confirmLabel: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      size="md"
      footer={
        <ModalFormFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel={cancelLabel}
          busy={busy}
          submitType="button"
          onSubmitClick={onConfirm}
          submitLabel={confirmLabel}
        />
      }
    >
      <div className={styles.formGrid}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <p className={styles.confirmBody}>{body}</p>
      </div>
    </DashboardModal>
  );
}
