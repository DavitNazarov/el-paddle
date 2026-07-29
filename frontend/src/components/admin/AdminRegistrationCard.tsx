'use client';

import { Building2, Mail, Phone, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/tournament/TournamentUI';
import { RegistrationStatusBadge, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { cn } from '@/lib/utils';
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

function Player({
  label,
  name,
  email,
  phone,
  club,
}: {
  label: string;
  name: string;
  email: string;
  phone: string;
  club: string;
}) {
  return (
    <div className={styles.player}>
      <p className={styles.playerLabel}>{label}</p>
      <p className={styles.playerName}>{name}</p>
      <div className={styles.contact}>
        <p>
          <Mail aria-hidden="true" />
          <span>{email}</span>
        </p>
        <p>
          <Phone aria-hidden="true" />
          <span>{phone}</span>
        </p>
        <p>
          <Building2 aria-hidden="true" />
          <span className={styles.club}>{club}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * One entry awaiting a decision. Only the transitions this state actually
 * allows are rendered — three buttons where two are permanently disabled reads
 * as a broken screen rather than a constrained one.
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
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.registrationsPage;

  return (
    <article className={styles.card} data-awaiting={!readOnly && isAwaitingReview(registration)}>
      <div className={styles.head}>
        <div className={styles.badges}>
          <RegistrationStatusBadge status={registration.status} />
          <Badge className="border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
            {registration.category.name}
          </Badge>
        </div>
        {readOnly ? null : (
          <div className={styles.actions}>
            {canReviewAs(registration, 'APPROVED') ? (
              <Button
                variant="red"
                className="min-h-11 rounded-md"
                disabled={busy}
                onClick={() => onReview('APPROVED')}
              >
                <UserCheck className="h-4 w-4" />
                {admin.registrations.approve}
              </Button>
            ) : null}
            {canReviewAs(registration, 'DECLINED') ? (
              <Button
                variant="destructive"
                className="min-h-11 rounded-md"
                disabled={busy}
                onClick={() => onReview('DECLINED')}
              >
                {admin.registrations.decline}
              </Button>
            ) : null}
            {canReviewAs(registration, 'PENDING') ? (
              <Button
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-md')}
                disabled={busy}
                onClick={() => onReview('PENDING')}
              >
                {admin.registrations.pending}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.players}>
        <Player
          label={copy.playerOne}
          name={registration.owner.fullName}
          email={registration.owner.email}
          phone={registration.ownerPhone}
          club={registration.owner.club?.name ?? copy.noClub}
        />
        <Player
          label={copy.playerTwo}
          name={registration.teammate.fullName}
          email={registration.teammate.email}
          phone={registration.teammatePhone || admin.registrations.noTeammatePhone}
          club={registration.teammate.club?.name ?? copy.noClub}
        />
      </div>

      {registration.declineReason ? (
        <div className={styles.reason}>
          <InlineNotice kind="error">
            {t('dashboard.admin.registrations.reason', { reason: registration.declineReason })}
          </InlineNotice>
        </div>
      ) : null}
    </article>
  );
}
