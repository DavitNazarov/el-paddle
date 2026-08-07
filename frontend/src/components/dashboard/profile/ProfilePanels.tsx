'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleAlert,
  CircleCheck,
  History,
  Settings,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SurfaceCard, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { accountRoleLabels } from '@/components/shared/account/AccountProfile';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { accountStateKey, accountStateTone } from './profileModel';
import styles from './Profile.module.css';

/**
 * What the club record adds to the session user's `club`: the reader's place in
 * it and how many players it fields. Both are `null` until it lands.
 */
export type ClubStanding = {
  membershipRole: 'LEADER' | 'MEMBER' | null;
  memberCount: number | null;
};

export function PanelHead({
  id,
  title,
  note,
  action,
}: {
  id: string;
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.panelHead}>
      <div className={styles.panelHeadText}>
        <h2 className={styles.panelTitle} id={id}>
          {title}
        </h2>
        {note ? <p className={styles.panelNote}>{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * One stated fact: an icon carrying its tone, the label, the value, and — only
 * where the reader has something to do about it — a hint and the amber spine
 * every queue in this product uses for "you are being asked for something".
 */
function Fact({
  icon: Icon,
  tone = 'neutral',
  label,
  value,
  hint,
  attention = false,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'positive' | 'warning';
  label: string;
  value: ReactNode;
  hint?: string;
  attention?: boolean;
}) {
  return (
    <li className={styles.fact} data-attention={attention}>
      <span className={styles.factIcon} data-tone={tone}>
        <Icon aria-hidden="true" />
      </span>
      <div className={styles.factText}>
        <p className={styles.factLabel}>{label}</p>
        <div className={styles.factValue}>{value}</div>
        {hint ? <p className={styles.factHint}>{hint}</p> : null}
      </div>
    </li>
  );
}

/**
 * What this account may do and how it stands. Three facts the reader cannot
 * change from here, which is exactly why they are stated rather than offered as
 * fields — an input box would promise otherwise.
 */
export function AccountStandingPanel({ user }: { user: PublicUser }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  const accountCopy = dictionary.dashboard.account;

  const stateTone = accountStateTone(user.status);
  const active = user.status === 'ACTIVE';

  return (
    <SurfaceCard className="overflow-hidden">
      <PanelHead id="profile-account-heading" title={copy.accountTitle} note={copy.accountDescription} />
      <ul className={styles.facts}>
        <Fact
          icon={UserRound}
          label={copy.role}
          value={accountRoleLabels(accountCopy)[user.role]}
        />
        <Fact
          icon={active ? CircleCheck : CircleAlert}
          tone={stateTone}
          label={copy.accountState}
          value={copy[accountStateKey(user.status)]}
          attention={!active}
        />
        <Fact
          icon={user.isVerified ? BadgeCheck : ShieldAlert}
          tone={user.isVerified ? 'positive' : 'warning'}
          label={copy.emailState}
          value={user.isVerified ? copy.verified : copy.unverified}
          hint={user.isVerified ? undefined : copy.unverifiedHint}
          attention={!user.isVerified}
        />
      </ul>
    </SurfaceCard>
  );
}

/**
 * The reader's standing inside their club. The role and the roster size come
 * from the club record rather than the session, so the line carrying them stays
 * absent until it lands — a club of "0 players" would be a lie told while
 * loading.
 */
export function ClubPanel({ user, standing }: { user: PublicUser; standing: ClubStanding }) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  const club = user.club;

  const membership = standing.membershipRole
    ? standing.membershipRole === 'LEADER'
      ? copy.clubLeader
      : copy.clubMember
    : null;
  const roster =
    standing.memberCount === null
      ? null
      : t('dashboard.player.profilePage.clubRoster', { count: standing.memberCount });
  const clubMeta = [membership, roster].filter(Boolean).join(' · ');

  return (
    <SurfaceCard className="overflow-hidden">
      <PanelHead id="profile-club-heading" title={copy.clubTitle} note={copy.clubDescription} />

      {club ? (
        <>
          <div className={styles.clubRow}>
            <span className={styles.clubCrest}>
              {club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logoUrl} alt="" />
              ) : (
                <Building2 aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className={styles.clubName}>{club.name}</p>
              {clubMeta ? <p className={styles.clubMeta}>{clubMeta}</p> : null}
            </div>
          </div>
          <div className={styles.panelFoot}>
            <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md px-4')}>
              <Link href="/dashboard/club">
                {copy.openClub}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md px-4')}>
              <Link href={`/clubs/${club.slug}`}>{copy.viewPublicClub}</Link>
            </Button>
          </div>
        </>
      ) : (
        <p className="p-5 text-sm leading-6 text-[var(--dash-muted)]">{copy.noClub}</p>
      )}
    </SurfaceCard>
  );
}

function LinkRow({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} className={styles.linkRow}>
      <span className={styles.factIcon}>
        <Icon aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn(styles.linkTitle, 'block')}>{title}</span>
        <span className={cn(styles.linkDetail, 'block')}>{detail}</span>
      </span>
      <ArrowRight className={styles.linkArrow} aria-hidden="true" />
    </Link>
  );
}

/**
 * Where the rest of this account lives. Streaks and partner records belong
 * beside the matches they are read from, and passwords beside the other things
 * that are not *about* the reader — so this page points at both rather than
 * repeating either.
 */
export function ElsewherePanel() {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.player.profilePage;
  const sidebar = dictionary.dashboard.player.sidebar;

  return (
    <SurfaceCard className="overflow-hidden">
      <PanelHead id="profile-elsewhere-heading" title={copy.elsewhereTitle} note={copy.elsewhereDescription} />
      <div>
        <LinkRow href="/dashboard/matches" icon={History} title={sidebar.matches} detail={copy.matchesDetail} />
        <LinkRow href="/dashboard/settings" icon={Settings} title={sidebar.settings} detail={copy.settingsDetail} />
      </div>
    </SurfaceCard>
  );
}
