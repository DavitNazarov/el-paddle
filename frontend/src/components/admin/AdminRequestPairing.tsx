'use client';

import { ArrowRight } from 'lucide-react';
import { CommandButton, InlineNotice, StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { OpponentRequestDto } from '@/types/tournament';
import styles from './AdminRequests.module.css';

export type RequestAction = 'approve' | 'reject' | 'override-refusal';

/** Statuses that still sit in the administrator's decision queue. */
export const AWAITING_DECISION = ['ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'CONFLICTED'];

export function isAwaitingDecision(request: OpponentRequestDto) {
  return AWAITING_DECISION.includes(request.status);
}

export function entryName(request: OpponentRequestDto, side: 'requestingEntry' | 'targetEntry') {
  const entry = request[side];
  return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
}

function statusIcon(status: OpponentRequestDto['status']) {
  if (status.includes('REFUSED') || status === 'CONFLICTED') return 'warning' as const;
  if (status.includes('APPROVED') || status.includes('APPLIED')) return 'check' as const;
  return 'dot' as const;
}

/**
 * One pairing request. A pairing is two entries facing each other, so the row
 * is drawn as requester → target rather than flattened into table columns
 * where the direction of the request has to be inferred from the header.
 */
export function AdminRequestPairing({
  request,
  readOnly,
  busyAction,
  onDecide,
}: {
  request: OpponentRequestDto;
  readOnly: boolean;
  busyAction: string;
  onDecide: (action: RequestAction) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.requests;
  const reason = request.responseReason || request.adminPublicReason;

  return (
    <li className={styles.pairing} data-awaiting={!readOnly && isAwaitingDecision(request)}>
      <div className={styles.sides}>
        <p className={styles.side}>
          <span className={styles.sideLabel}>{copy.requesting}</span>
          <span className={styles.sideName}>{entryName(request, 'requestingEntry')}</span>
        </p>
        <ArrowRight className={styles.arrow} aria-hidden="true" />
        <p className={styles.side}>
          <span className={styles.sideLabel}>{copy.target}</span>
          <span className={styles.sideName}>{entryName(request, 'targetEntry')}</span>
        </p>
      </div>

      <div className={styles.pairingFoot}>
        <StatusLabel icon={statusIcon(request.status)}>{tournamentStatus(locale, request.status)}</StatusLabel>
        {readOnly ? null : (
          <div className={styles.pairingActions}>
            {request.status === 'ACCEPTED_BY_OPPONENT' ? (
              <CommandButton
                tone="primary"
                size="sm"
                busy={busyAction === `approve-${request.id}`}
                onClick={() => onDecide('approve')}
              >
                {copy.approve}
              </CommandButton>
            ) : null}
            {request.status === 'REFUSED_BY_OPPONENT' ? (
              <CommandButton
                size="sm"
                busy={busyAction === `override-refusal-${request.id}`}
                onClick={() => onDecide('override-refusal')}
              >
                {copy.override}
              </CommandButton>
            ) : null}
            {isAwaitingDecision(request) ? (
              <CommandButton
                tone="danger"
                size="sm"
                busy={busyAction === `reject-${request.id}`}
                onClick={() => onDecide('reject')}
              >
                {copy.reject}
              </CommandButton>
            ) : null}
          </div>
        )}
      </div>

      {reason ? (
        <div className={styles.pairingReason}>
          <InlineNotice kind={request.status.includes('REFUSED') ? 'error' : 'info'}>{reason}</InlineNotice>
        </div>
      ) : null}
    </li>
  );
}
