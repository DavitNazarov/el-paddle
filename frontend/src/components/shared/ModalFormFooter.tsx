'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { modalSoftButtonClassName } from '@/components/shared/dashboard/DashboardUI';

type ModalFormFooterProps = {
  formId?: string;
  onCancel: () => void;
  cancelLabel: string;
  submitLabel: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  submitType?: 'submit' | 'button';
  onSubmitClick?: () => void;
  submitVariant?: 'red' | 'outline' | 'destructive';
  submitClassName?: string;
};

export function ModalFormFooter({
  formId,
  onCancel,
  cancelLabel,
  submitLabel,
  busy = false,
  disabled = false,
  submitType = 'submit',
  onSubmitClick,
  submitVariant = 'red',
  submitClassName,
}: ModalFormFooterProps) {
  return (
    <>
      <Button type="button" variant="outline" className={modalSoftButtonClassName} onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button
        type={submitType}
        form={formId}
        variant={submitVariant}
        className={submitClassName}
        disabled={busy || disabled}
        onClick={onSubmitClick}
      >
        {submitLabel}
      </Button>
    </>
  );
}
