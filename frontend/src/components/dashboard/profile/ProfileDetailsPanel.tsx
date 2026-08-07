'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DashboardModal,
  FeedbackBanner,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import {
  AccountProfileFields,
  useProfileEditor,
  type OwnAccount,
} from '@/components/shared/account/AccountProfile';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { PanelHead } from './ProfilePanels';
import styles from './Profile.module.css';

const FORM_ID = 'profile-details-form';

/**
 * One recorded value. A blank one is said out loud rather than left as an empty
 * cell, and when the platform actually needs it the cell carries the amber
 * spine — a player without a phone number cannot be reached on match day.
 */
function Detail({
  label,
  value,
  missingLabel,
  required = false,
}: {
  label: string;
  value: string;
  missingLabel: string;
  required?: boolean;
}) {
  const filled = Boolean(value.trim());
  return (
    <div className={styles.detail} data-attention={required && !filled}>
      <p className={styles.detailLabel}>{label}</p>
      <p className={styles.detailValue} data-missing={!filled}>
        {filled ? value : missingLabel}
      </p>
    </div>
  );
}

/**
 * What the platform has recorded about the reader, stated rather than laid out
 * as a form. The page is read far more often than it is edited, so the fields
 * open in a modal on request instead of sitting on screen as four inputs the
 * reader has to look past every visit.
 */
export function ProfileDetailsPanel({
  user,
  account,
  loadError,
}: {
  user: PublicUser;
  account: OwnAccount | null;
  loadError: string;
}) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  const accountCopy = dictionary.dashboard.account;

  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const editor = useProfileEditor({
    user,
    account,
    onSaved: () => {
      setEditing(false);
      setConfirmed(true);
    },
  });

  // Leaving the modal by any route — Cancel, Escape, the overlay — throws away
  // what was typed. The card behind it must never show an edit nobody saved.
  function close() {
    editor.discard();
    setEditing(false);
  }

  return (
    <div className="grid gap-3">
      {confirmed ? (
        <FeedbackBanner kind="success" onDismiss={() => setConfirmed(false)}>
          {accountCopy.profileSaved}
        </FeedbackBanner>
      ) : null}

      <SurfaceCard className="overflow-hidden">
        <PanelHead
          id="profile-details-heading"
          title={copy.detailsTitle}
          note={copy.detailsDescription}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
              className={cn(softButtonClassName, 'min-h-11 shrink-0 rounded-md px-4')}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {copy.editDetails}
            </Button>
          }
        />

        {loadError ? (
          <div className="p-5">
            <FeedbackBanner kind="error">{loadError}</FeedbackBanner>
          </div>
        ) : null}

        <div className={styles.detailGrid}>
          <Detail label={accountCopy.name} value={editor.saved.name} missingLabel={copy.notProvided} required />
          <Detail label={accountCopy.surname} value={editor.saved.surname} missingLabel={copy.notProvided} required />
          <Detail
            label={accountCopy.phone}
            value={editor.saved.phone}
            missingLabel={copy.notProvided}
            required={user.role === 'USER'}
          />
          <Detail label={accountCopy.email} value={user.email} missingLabel={copy.notProvided} />
        </div>

        <p className={styles.detailNote}>{accountCopy.emailHint}</p>
      </SurfaceCard>

      <DashboardModal
        open={editing}
        onOpenChange={(open) => (open ? setEditing(true) : close())}
        title={copy.detailsTitle}
        description={copy.detailsDescription}
        size="md"
        footer={
          <ModalFormFooter
            formId={FORM_ID}
            onCancel={close}
            cancelLabel={t('common.cancel')}
            submitLabel={editor.busy ? accountCopy.saving : accountCopy.save}
            busy={editor.busy}
          />
        }
      >
        <form id={FORM_ID} onSubmit={editor.save} className="grid gap-4">
          {editor.error ? <FeedbackBanner kind="error">{editor.error}</FeedbackBanner> : null}
          <AccountProfileFields editor={editor} email={user.email} />
        </form>
      </DashboardModal>
    </div>
  );
}
