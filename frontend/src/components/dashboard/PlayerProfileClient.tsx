'use client';

import { useEffect, useState } from 'react';
import { useOwnAccount } from '@/components/shared/account/AccountProfile';
import { InlineNotice } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import { PlayerShell } from './PlayerShell';
import { ProfilePassport } from './profile/ProfilePassport';
import { ProfileDetailsPanel } from './profile/ProfileDetailsPanel';
import {
  AccountStandingPanel,
  ClubPanel,
  ElsewherePanel,
  type ClubStanding,
} from './profile/ProfilePanels';
import styles from './profile/Profile.module.css';

const unknownStanding: ClubStanding = { membershipRole: null, memberCount: null };

/**
 * The reader's standing inside their club, fetched on its own because the
 * session user carries the club but not their place in it. Both fields stay
 * `null` until the record lands and after a failure, so a slow or refused read
 * shows one fewer fact rather than an invented one.
 */
function useClubStanding(hasClub: boolean): ClubStanding {
  const [standing, setStanding] = useState<ClubStanding>(unknownStanding);

  useEffect(() => {
    if (!hasClub) return;
    let cancelled = false;
    void apiFetch('/api/account/club-details', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: {
          club?: { currentUserMembershipRole?: 'LEADER' | 'MEMBER'; members?: unknown[] };
        } | null) => {
          if (cancelled || !data?.club) return;
          setStanding({
            membershipRole: data.club.currentUserMembershipRole ?? null,
            memberCount: Array.isArray(data.club.members) ? data.club.members.length : null,
          });
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasClub]);

  return standing;
}

export function PlayerProfileClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t, formatDate } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  const { account, error: accountError } = useOwnAccount();
  const standing = useClubStanding(Boolean(initialUser.club));

  return (
    <PlayerShell
      title={copy.title}
      description={copy.description}
      eyebrow={copy.eyebrow}
      user={initialUser}
    >
      <div className="space-y-6">
        {/* A disqualification outranks the card itself: it is the one fact on
            this page that changes what the reader can do next. */}
        {initialUser.isDisqualified ? (
          <InlineNotice kind="warning" title={copy.disqualifiedTitle}>
            {initialUser.disqualifiedUntil
              ? `${t('dashboard.player.profilePage.disqualifiedUntil', {
                  date: formatDate(initialUser.disqualifiedUntil, { dateStyle: 'medium' }),
                })} `
              : null}
            {initialUser.disqualificationReason
              ? t('dashboard.player.profilePage.disqualifiedReason', {
                  reason: initialUser.disqualificationReason,
                })
              : copy.disqualifiedNoReason}
          </InlineNotice>
        ) : null}

        <ProfilePassport user={initialUser} />

        <ProfileDetailsPanel user={initialUser} account={account} loadError={accountError} />

        <div className={styles.panels}>
          <AccountStandingPanel user={initialUser} />
          <ClubPanel user={initialUser} standing={standing} />
          <ElsewherePanel />
        </div>
      </div>
    </PlayerShell>
  );
}
