'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Building2, CircleAlert, Mail, Phone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoChip, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { initialsOf } from '@/components/shared/account/accountModel';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { accountStateKey, hasPublicPlayerPage, recordArcs, winRate } from './profileModel';
import styles from './Profile.module.css';

/**
 * A padel court seen from above — outer walls, the net across the middle, the
 * two service lines and the centre line. Drawn rather than imported so it
 * inherits the crest's colour and costs nothing to load.
 */
function CourtMotif() {
  return (
    <svg
      className={styles.court}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="7" y="13" width="50" height="38" rx="1.5" />
      <line x1="7" y1="32" x2="57" y2="32" strokeWidth="2" />
      <line x1="7" y1="21" x2="57" y2="21" />
      <line x1="7" y1="43" x2="57" y2="43" />
      <line x1="32" y1="13" x2="32" y2="21" />
      <line x1="32" y1="43" x2="32" y2="51" />
    </svg>
  );
}

/**
 * The record as a closed ring. The ring is decoration and is hidden from
 * assistive technology; the win rate in its centre is ordinary text, and the
 * counts it is made of are stated in the band below the card.
 */
function RecordRing({ percent, arcs }: { percent: number; arcs: ReturnType<typeof recordArcs> }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  // At this radius the circumference is exactly 100 user units, so an arc's
  // length in the dash array *is* its percentage — no arc arithmetic needed.
  const RADIUS = 15.915;

  return (
    <div className={styles.ringWrap}>
      <svg className={styles.ring} viewBox="0 0 42 42" aria-hidden="true" focusable="false">
        <circle className={styles.ringTrack} cx="21" cy="21" r={RADIUS} />
        {arcs.map((arc) => (
          <circle
            key={arc.tone}
            className={styles.ringArc}
            data-tone={arc.tone}
            cx="21"
            cy="21"
            r={RADIUS}
            strokeDasharray={`${arc.share} ${100 - arc.share}`}
            strokeDashoffset={arc.offset}
          />
        ))}
      </svg>
      <div className={styles.ringCenter}>
        <p className={styles.ringValue}>{percent}%</p>
        <p className={styles.ringLabel}>{copy.winRateShort}</p>
      </div>
    </div>
  );
}

/**
 * The player card: who this account belongs to and how it has done, as one
 * object. Everything on it is stated by the server — nothing here is editable,
 * which is why the editable fields live in their own panel below.
 */
export function ProfilePassport({ user }: { user: PublicUser }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;

  const { matchesPlayed, wins, losses } = user.stats;
  const percent = winRate(user.stats);
  const arcs = recordArcs(user.stats);

  // At most one exception chip. A pending account and an unverified address are
  // two readings of the same fact, and saying it twice makes neither louder.
  const pendingState = user.status !== 'ACTIVE' ? accountStateKey(user.status) : null;
  const showUnverified = !user.isVerified && user.status !== 'PENDING_VERIFICATION';
  const flagged = Boolean(pendingState) || showUnverified;

  return (
    <section className={styles.passport} data-flagged={flagged} aria-labelledby="profile-passport-name">
      <div className={styles.passportTop}>
        <div className={styles.identity}>
          <span className={styles.crest}>
            <CourtMotif />
            <span className={styles.crestInitials} aria-hidden="true">
              {initialsOf(user)}
            </span>
            {user.club?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.club.logoUrl} alt="" className={styles.crestClub} />
            ) : null}
          </span>

          <div className={styles.identityText}>
            <p className={styles.eyebrow}>{copy.cardEyebrow}</p>
            <h2 className={styles.name} id="profile-passport-name">
              {user.fullName}
            </h2>

            <div className={styles.meta}>
              {user.club ? (
                <span className={styles.metaItem}>
                  <Building2 aria-hidden="true" />
                  <span className={styles.metaText}>{user.club.name}</span>
                </span>
              ) : null}
              <span className={styles.metaItem}>
                <Mail aria-hidden="true" />
                <span className={styles.metaText}>{user.email}</span>
              </span>
              {user.phone ? (
                <span className={styles.metaItem}>
                  <Phone aria-hidden="true" />
                  <span className={styles.metaText}>{user.phone}</span>
                </span>
              ) : null}
            </div>

            {pendingState || showUnverified ? (
              <div className={styles.chips}>
                {pendingState ? (
                  <InfoChip icon={CircleAlert} tone="warning">
                    {copy[pendingState]}
                  </InfoChip>
                ) : null}
                {showUnverified ? (
                  <InfoChip icon={ShieldAlert} tone="warning">
                    {copy.unverified}
                  </InfoChip>
                ) : null}
              </div>
            ) : null}

            {/* Offered only where `/players/:id` would actually resolve. */}
            {hasPublicPlayerPage(user) ? (
              <Link href={`/players/${user.id}`} className={styles.publicLink}>
                {copy.publicProfile}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        {percent !== null ? <RecordRing percent={percent} arcs={arcs} /> : null}
      </div>

      {matchesPlayed > 0 ? (
        <>
          <div className={styles.band}>
            <div className={styles.bandCell}>
              <p className={styles.bandValue}>{matchesPlayed}</p>
              <p className={styles.bandLabel}>{copy.matchesPlayed}</p>
            </div>
            <div className={styles.bandCell}>
              <p className={styles.bandValue}>{wins}</p>
              <p className={styles.bandLabel}>
                <span className={styles.bandDot} data-tone="win" aria-hidden="true" />
                {copy.wins}
              </p>
            </div>
            <div className={styles.bandCell}>
              <p className={styles.bandValue}>{losses}</p>
              <p className={styles.bandLabel}>
                <span className={styles.bandDot} data-tone="loss" aria-hidden="true" />
                {copy.losses}
              </p>
            </div>
          </div>
          <p className={styles.bandNote}>{copy.recordDescription}</p>
        </>
      ) : (
        <div className={styles.bandEmpty}>
          <p className={styles.bandEmptyText}>{copy.noMatches}</p>
          <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md px-4')}>
            <Link href="/dashboard/events">
              {copy.noMatchesAction}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
