'use client';

import Link from 'next/link';
import { Crown, Inbox, ListChecks, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SurfaceCard, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { cn } from '@/lib/utils';

/**
 * Which of the two you are, and what that lets you do.
 *
 * The roster already carried a "Leader" badge, but a badge on one of eight rows
 * answers "who leads this club" only if you also know which row is you — and it
 * never said what leading one actually permits. The powers themselves were
 * spread across three places: a small link beside the public-page link, a
 * per-row control that only appears on other people's rows, a section further
 * down the page, and two commands on an entirely different screen.
 *
 * So this states the fact in a sentence and puts every command a leader holds
 * in one row beneath it. A member gets the same band with the leader's name in
 * it, because the useful thing for them is knowing who to ask.
 */
export function ClubLeadershipBand({
  isLeader,
  clubName,
  leaderName,
  pendingRequests,
  onEditClub,
  onInviteMember,
  onReviewRequests,
}: {
  isLeader: boolean;
  clubName: string;
  /** The current leader, for the member's view. Null while the roster is loading. */
  leaderName: string | null;
  pendingRequests: number;
  onEditClub: () => void;
  onInviteMember: () => void;
  onReviewRequests: () => void;
}) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.clubPage.leadership;

  return (
    <SurfaceCard className="p-5" featured={isLeader}>
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full border',
            isLeader
              ? 'border-[#e4c98f] bg-[#fff9ec] text-[#a86712]'
              : 'border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]',
          )}
        >
          {isLeader ? <Crown className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dash-faint)]">
            {isLeader ? copy.leaderEyebrow : copy.memberEyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-6 text-[var(--dash-text)]">
            {isLeader
              ? t('dashboard.player.clubPage.leadership.leaderTitle', { club: clubName })
              : t('dashboard.player.clubPage.leadership.memberTitle', { club: clubName })}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-[var(--dash-muted)]">
            {isLeader
              ? copy.leaderDescription
              : leaderName
                ? t('dashboard.player.clubPage.leadership.memberLed', { name: leaderName })
                : copy.memberNoLeader}
          </p>

          {isLeader ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                onClick={onEditClub}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {copy.editClub}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                onClick={onInviteMember}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {copy.inviteMember}
              </Button>
              {/* The count is the point of this one: a leader who has nothing
                  waiting should not be sent to an empty queue. */}
              <Button
                type="button"
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                disabled={pendingRequests === 0}
                onClick={onReviewRequests}
              >
                <Inbox className="h-4 w-4" aria-hidden="true" />
                {pendingRequests > 0
                  ? t('dashboard.player.clubPage.leadership.reviewRequests', { count: pendingRequests })
                  : copy.noRequestsWaiting}
              </Button>
              {/* Entries live on their own screen, so the band says where the
                  remaining two leader commands are rather than pretending they
                  are not leader commands. */}
              <Button
                asChild
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
              >
                <Link href="/dashboard/entries">
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  {copy.manageEntries}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}
