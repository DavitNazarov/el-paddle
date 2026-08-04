'use client';

import type { ReactNode } from 'react';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
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
