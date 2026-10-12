'use client';

import { Building2, Mail, Phone } from 'lucide-react';
import { CommandButton, StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { RegistrationDto } from '@/types/admin';
import styles from './AdminReview.module.css';

/** Which decisions each state can still move to. Mirrors the server's rules. */
const reviewTransitions: Partial<Record<RegistrationDto['status'], RegistrationDto['status'][]>> = {
  PENDING: ['APPROVED', 'DECLINED'],
  APPROVED: ['DECLINED'],
  NEEDS_CHANGES: ['PENDING', 'APPROVED', 'DECLINED'],
  WAITLISTED: ['APPROVED', 'DECLINED'],
};

export function canReviewAs(registration: RegistrationDto, status: RegistrationDto['status']) {
  return reviewTransitions[registration.status]?.includes(status) ?? false;
}

/** Entries the reviewer has not answered yet — the actual work in the queue. */
export function isAwaitingReview(registration: RegistrationDto) {
  return registration.status === 'PENDING' || registration.status === 'NEEDS_CHANGES';
}

/** Both players, because a reviewer checks the pair, not one name. */
export function teamName(registration: RegistrationDto, separator: string) {
  return `${registration.owner.fullName}${separator}${registration.teammate.fullName}`;
}

/**
 * One entry, as a row in a queue rather than a card in a gallery.
 *
 * A reviewer decides on the pair, their club and their category — so those three
 * things are the row, and the contact details sit under them in one quiet line
 * for the times a decision needs a phone call. It used to take a two-column
 * grid and six labelled contact fields per entry, which is a screenful for one
 * decision and meant scrolling to compare two entries in the same category.
 */
export function AdminRegistrationCard({
  registration,
  readOnly,
  busy,
  onReview,
}: {
  registration: RegistrationDto;
  readOnly: boolean;
  busy: boolean;
  onReview: (status: RegistrationDto['status']) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.review;
  const awaiting = isAwaitingReview(registration);
  const club = registration.owner.club?.name ?? copy.noClub;
  const team = teamName(registration, copy.pairSeparator);

  return (
    <li className={styles.row} data-awaiting={!readOnly && awaiting} data-status={registration.status.toLowerCase()}>
      <div className={styles.rowText}>
        <p className={styles.rowMeta}>
          <StatusLabel icon={registration.status === 'APPROVED' ? 'check' : 'dot'}>
            {statusWord(registration.status, copy)}
          </StatusLabel>
          <span className={styles.rowCategory}>{registration.category.name}</span>
          <span className={styles.rowClub}>
            <Building2 aria-hidden="true" />
            {club}
          </span>
        </p>

        <p className={styles.rowTeam}>{team}</p>

        <p className={styles.rowContact} aria-label={fillTemplate(copy.contactLabel, { team })}>
          <span>
            <Mail aria-hidden="true" />
            {registration.owner.email}
          </span>
          {registration.ownerPhone ? (
            <span>
              <Phone aria-hidden="true" />
              {registration.ownerPhone}
            </span>
          ) : null}
          <span>
            <Mail aria-hidden="true" />
            {registration.teammate.email}
          </span>
          {registration.teammatePhone ? (
            <span>
              <Phone aria-hidden="true" />
              {registration.teammatePhone}
            </span>
          ) : null}
        </p>

        {registration.declineReason ? (
          <p className={styles.rowReason}>
            {fillTemplate(copy.declinedReason, { reason: registration.declineReason })}
          </p>
        ) : null}
      </div>

      {readOnly ? null : (
        <div className={styles.rowActions}>
          {canReviewAs(registration, 'APPROVED') ? (
            <CommandButton tone="primary" busy={busy} onClick={() => onReview('APPROVED')}>
              {copy.approve}
            </CommandButton>
          ) : null}
          {canReviewAs(registration, 'DECLINED') ? (
            <CommandButton tone="danger" disabled={busy} onClick={() => onReview('DECLINED')}>
              {copy.decline}
            </CommandButton>
          ) : null}
          {canReviewAs(registration, 'PENDING') ? (
            <CommandButton disabled={busy} onClick={() => onReview('PENDING')}>
              {copy.returnToQueue}
            </CommandButton>
          ) : null}
        </div>
      )}
    </li>
  );
}

type ReviewCopy = (typeof tournamentCopy)['en' | 'ka']['admin']['review'];

/** The state in the same word the filter above the queue uses for it. */
function statusWord(status: RegistrationDto['status'], copy: ReviewCopy) {
  if (status === 'APPROVED') return copy.filterApproved;
  if (status === 'DECLINED') return copy.filterDeclined;
  return copy.filterPending;
}
