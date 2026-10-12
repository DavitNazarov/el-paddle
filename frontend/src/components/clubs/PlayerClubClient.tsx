'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Crown,
  ExternalLink,
  LoaderCircle,
  LogOut,
  MailCheck,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayerShell } from '@/components/dashboard/PlayerShell';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  modalSoftButtonClassName,
  RegistrationStatusBadge,
  selectControlClassName,
  SectionHeading,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch, readApiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { ClubLeadershipBand } from './ClubLeadershipBand';
import { ClubMateInvite } from './ClubMateInvite';
import { ClubProfileEditor } from './ClubProfileEditor';

type MembershipRole = 'LEADER' | 'MEMBER';

type ClubMember = {
  id: string;
  membershipRole: MembershipRole;
  roleTitle: string;
  user: {
    id: string;
    fullName: string;
    status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED' | 'INACTIVE';
  };
};

type ClubJoinRequest = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
  };
};

type PlayerClub = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  currentUserMembershipRole: MembershipRole;
  members: ClubMember[];
  joinRequests: ClubJoinRequest[];
};

type RemovalImpactRegistration = {
  id: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'NEEDS_CHANGES' | 'WAITLISTED';
  removedSlot: 'owner' | 'teammate';
  owner: { id: string; fullName: string };
  teammate: { id: string; fullName: string };
  event: {
    id: string;
    title: string;
    date: string;
    status: 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ONGOING';
  };
  category: { id: string; name: string };
  blockedReason: 'EVENT_ONGOING' | 'BRACKET_LOCKED' | null;
};

type RemovalImpact = {
  member: { id: string; userId: string; fullName: string };
  affectedRegistrations: RemovalImpactRegistration[];
  eligibleReplacements: { id: string; fullName: string; hasPhone: boolean }[];
};

type RemovalResolution = {
  action: 'REPLACE' | 'WITHDRAW';
  replacementUserId: string;
};

export function PlayerClubClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t, formatDate } = useI18n();
  const copy = dictionary.dashboard.player.clubPage;
  const [club, setClub] = useState<PlayerClub | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [kickTarget, setKickTarget] = useState<ClubMember | null>(null);
  const [removalImpact, setRemovalImpact] = useState<RemovalImpact | null>(null);
  const [removalResolutions, setRemovalResolutions] = useState<Record<string, RemovalResolution>>({});
  const [removalError, setRemovalError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [invitingMember, setInvitingMember] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/account/club-details');
      const data = await readApiJson<{ club?: PlayerClub; error?: string }>(response, {});
      if (!response.ok || !data.club) throw new Error(data.error || copy.loadError);
      setClub(data.club);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function replacementCandidates(registration: RemovalImpactRegistration) {
    if (!removalImpact) return [];
    const retainedPlayerId =
      registration.removedSlot === 'owner'
        ? registration.teammate.id
        : registration.owner.id;
    return removalImpact.eligibleReplacements.filter(
      (candidate) =>
        candidate.id !== retainedPlayerId &&
        (registration.removedSlot !== 'owner' || candidate.hasPhone),
    );
  }

  const openRemoval = async (member: ClubMember) => {
    setKickTarget(member);
    setRemovalImpact(null);
    setRemovalResolutions({});
    setRemovalError('');
    setBusyAction(`impact:${member.id}`);
    try {
      const response = await apiFetch(`/api/account/club/members/${member.id}/removal-impact`, {
        cache: 'no-store',
      });
      const data = await readApiJson<{ impact?: RemovalImpact; error?: string }>(response, {});
      if (!response.ok || !data.impact) {
        setRemovalError(data.error ?? copy.impactError);
        return;
      }
      setRemovalImpact(data.impact);
      const initialResolutions = Object.fromEntries(
        data.impact.affectedRegistrations.map((registration) => {
          const retainedPlayerId =
            registration.removedSlot === 'owner'
              ? registration.teammate.id
              : registration.owner.id;
          const candidates = data.impact!.eligibleReplacements.filter(
            (candidate) =>
              candidate.id !== retainedPlayerId &&
              (registration.removedSlot !== 'owner' || candidate.hasPhone),
          );
          return [
            registration.id,
            {
              action: candidates.length ? 'REPLACE' : 'WITHDRAW',
              replacementUserId: candidates[0]?.id ?? '',
            } satisfies RemovalResolution,
          ];
        }),
      );
      setRemovalResolutions(initialResolutions);
    } catch {
      setRemovalError(copy.impactError);
    } finally {
      setBusyAction('');
    }
  };

  function closeRemoval() {
    setKickTarget(null);
    setDeparting(false);
    setRemovalImpact(null);
    setRemovalResolutions({});
    setRemovalError('');
  }

  const removeMember = async () => {
    if (!kickTarget || !removalImpact) return;
    setBusyAction(`remove:${kickTarget.id}`);
    setError('');
    setFeedback('');
    setRemovalError('');
    try {
      const response = await apiFetch(`/api/account/club/members/${kickTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          resolutions: removalImpact.affectedRegistrations.map((registration) => ({
            registrationId: registration.id,
            expectedVersion: registration.version,
            action: removalResolutions[registration.id]?.action,
            replacementUserId:
              removalResolutions[registration.id]?.action === 'REPLACE'
                ? removalResolutions[registration.id]?.replacementUserId
                : undefined,
          })),
        }),
      });
      const data = await readApiJson<{ club?: PlayerClub; error?: string }>(response, {});
      if (!response.ok || !data.club) {
        setRemovalError(data.error ?? copy.actionError);
        return;
      }
      setClub(data.club);
      setFeedback(t('dashboard.player.clubPage.removedSuccess', {
        name: kickTarget.user.fullName,
        club: data.club.name,
      }));
      closeRemoval();
    } catch {
      setRemovalError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  /**
   * Leaving is the same write as being removed and resolves the same entries,
   * so it reuses the removal dialog rather than growing a second one that would
   * have to be kept in step with it. `departing` only changes whose authority
   * the request carries and which words the dialog uses.
   */
  const [departing, setDeparting] = useState(false);

  const openDeparture = async () => {
    setDeparting(true);
    setRemovalImpact(null);
    setRemovalResolutions({});
    setRemovalError('');
    setBusyAction('impact:self');
    try {
      const response = await apiFetch('/api/account/club/departure-impact', { cache: 'no-store' });
      const data = await readApiJson<{ impact?: RemovalImpact; error?: string }>(response, {});
      if (!response.ok || !data.impact) {
        setRemovalError(data.error ?? copy.impactError);
        return;
      }
      setRemovalImpact(data.impact);
      setRemovalResolutions(Object.fromEntries(
        data.impact.affectedRegistrations.map((registration) => {
          const retainedPlayerId =
            registration.removedSlot === 'owner' ? registration.teammate.id : registration.owner.id;
          const candidates = data.impact!.eligibleReplacements.filter(
            (candidate) =>
              candidate.id !== retainedPlayerId &&
              (registration.removedSlot !== 'owner' || candidate.hasPhone),
          );
          return [
            registration.id,
            {
              action: candidates.length ? 'REPLACE' : 'WITHDRAW',
              replacementUserId: candidates[0]?.id ?? '',
            } satisfies RemovalResolution,
          ];
        }),
      ));
    } catch {
      setRemovalError(copy.impactError);
    } finally {
      setBusyAction('');
    }
  };

  const leaveClub = async () => {
    if (!removalImpact) return;
    setBusyAction('remove:self');
    setRemovalError('');
    try {
      const response = await apiFetch('/api/account/club/leave', {
        method: 'POST',
        body: JSON.stringify({
          resolutions: removalImpact.affectedRegistrations.map((registration) => ({
            registrationId: registration.id,
            expectedVersion: registration.version,
            action: removalResolutions[registration.id]?.action,
            replacementUserId:
              removalResolutions[registration.id]?.action === 'REPLACE'
                ? removalResolutions[registration.id]?.replacementUserId
                : undefined,
          })),
        }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setRemovalError(data.error ?? copy.actionError);
        return;
      }
      // The club is gone from under this screen; the club-picker is the only
      // place left that makes sense.
      window.location.href = '/complete-club';
    } catch {
      setRemovalError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  /** Handing leadership over, and taking back an invitation nobody accepted. */
  const [promoteTarget, setPromoteTarget] = useState<ClubMember | null>(null);

  const transferLeadership = async () => {
    if (!promoteTarget) return;
    setBusyAction(`promote:${promoteTarget.id}`);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/account/club/members/${promoteTarget.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ membershipRole: 'LEADER' }),
      });
      const data = await readApiJson<{ club?: PlayerClub; error?: string }>(response, {});
      if (!response.ok || !data.club) {
        setError(data.error ?? copy.actionError);
        return;
      }
      setClub(data.club);
      setFeedback(t('dashboard.player.clubPage.leadershipMoved', { name: promoteTarget.user.fullName }));
      setPromoteTarget(null);
    } catch {
      setError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  const resendInvite = async (member: ClubMember) => {
    setBusyAction(`resend:${member.id}`);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/account/club/members/${member.id}/invite/resend`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.actionError);
        return;
      }
      setFeedback(t('dashboard.player.clubPage.inviteResent', { name: member.user.fullName }));
    } catch {
      setError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  const revokeInvite = async (member: ClubMember) => {
    setBusyAction(`revoke:${member.id}`);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/account/club/members/${member.id}/invite`, {
        method: 'DELETE',
      });
      const data = await readApiJson<{ club?: PlayerClub; error?: string }>(response, {});
      if (!response.ok || !data.club) {
        setError(data.error ?? copy.actionError);
        return;
      }
      setClub(data.club);
      setFeedback(t('dashboard.player.clubPage.inviteRevoked', { name: member.user.fullName }));
    } catch {
      setError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  // Approving is additive and easy to reverse (remove the member); rejecting
  // throws the request away, so only rejection asks for confirmation.
  const [rejectTarget, setRejectTarget] = useState<ClubJoinRequest | null>(null);

  const reviewRequest = async (requestId: string, decision: 'approve' | 'reject') => {
    setBusyAction(`${decision}:${requestId}`);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/account/club/join-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      const data = await readApiJson<{ club?: PlayerClub; error?: string }>(response, {});
      if (!response.ok || !data.club) {
        setError(data.error ?? copy.actionError);
        return;
      }
      setClub(data.club);
      setFeedback(decision === 'approve' ? copy.approvedSuccess : copy.rejectedSuccess);
      setRejectTarget(null);
    } catch {
      setError(copy.actionError);
    } finally {
      setBusyAction('');
    }
  };

  const isLeader = club?.currentUserMembershipRole === 'LEADER';
  const leaderName = club?.members.find((member) => member.membershipRole === 'LEADER')?.user.fullName ?? null;
  /**
   * Leader first, then everyone else in the order they joined. The badge alone
   * left the reader scanning eight rows for a crown; putting the leader at the
   * top means the answer is where a reader looks first.
   */
  const roster = club
    ? [...club.members].sort((left, right) =>
        left.membershipRole === right.membershipRole ? 0 : left.membershipRole === 'LEADER' ? -1 : 1)
    : [];
  const impactLoading = busyAction === 'impact:self'
    || Boolean(kickTarget && busyAction === `impact:${kickTarget.id}`);
  const hasBlockedRegistration = Boolean(
    removalImpact?.affectedRegistrations.some((registration) => registration.blockedReason),
  );
  const resolutionsComplete = Boolean(
    removalImpact &&
      removalImpact.affectedRegistrations.every((registration) => {
        if (registration.blockedReason) return false;
        const resolution = removalResolutions[registration.id];
        if (!resolution) return false;
        return resolution.action === 'WITHDRAW' || Boolean(resolution.replacementUserId);
      }),
  );

  return (
    <PlayerShell
      user={initialUser}
      eyebrow={copy.eyebrow}
      title={club?.name ?? copy.title}
      description={club?.description || copy.description}
    >
      <div aria-live="polite">
        {error ? (
          <FeedbackBanner
            kind="error"
            actions={
              // A failed load is recoverable — offer the way back instead of a
              // dead page that looks like the player has no club.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(softButtonClassName, 'rounded-md')}
                onClick={() => void load()}
              >
                {copy.retry}
              </Button>
            }
          >
            {error}
          </FeedbackBanner>
        ) : null}
        {feedback ? <FeedbackBanner kind="success">{feedback}</FeedbackBanner> : null}
      </div>

      {loading ? (
        <SurfaceCard className="p-5">
          <div className="flex min-h-28 items-center gap-3 text-[var(--dash-muted)]">
            <Clock3 className="h-5 w-5 animate-pulse" />
            {t('common.loading')}
          </div>
        </SurfaceCard>
      ) : null}

      {club ? (
        <div className="space-y-8">
          {/* Before anything else: which of the two you are, and the commands
              that come with it. */}
          <ClubLeadershipBand
            isLeader={isLeader}
            clubName={club.name}
            leaderName={leaderName}
            pendingRequests={club.joinRequests.length}
            onEditClub={() => setEditingProfile(true)}
            onInviteMember={() => setInvitingMember(true)}
            onReviewRequests={() => {
              document.getElementById('club-join-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          <section className="grid gap-4 sm:grid-cols-3" aria-label={copy.description}>
            <SurfaceCard className="p-5 sm:col-span-2">
              <div className="flex items-start gap-4">
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={club.logoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg border border-[var(--dash-border)] object-cover"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-tint)]">
                    <Building2 className="h-5 w-5 text-[var(--dash-primary)]" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dash-faint)]">
                    {copy.title}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--dash-text)]">{club.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--dash-muted)]">
                    {club.description || copy.description}
                  </p>
                  {/* Editing lives in the leadership band above, with the rest
                      of the leader's commands. One home for them, not two. */}
                  <Link
                    href={`/clubs/${club.slug}`}
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--dash-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
                  >
                    {copy.publicPage}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dash-faint)]">
                {copy.membersTitle}
              </p>
              <p className="mt-3 font-display text-4xl font-semibold text-[var(--dash-text)]">
                {club.members.length}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-[var(--dash-muted)]">
                {isLeader ? <Crown className="h-4 w-4 text-[#a86712]" /> : <ShieldCheck className="h-4 w-4" />}
                {isLeader ? copy.leader : copy.member}
              </p>
            </SurfaceCard>
          </section>

          <section>
            <SectionHeading
              eyebrow={copy.eyebrow}
              title={copy.membersTitle}
              description={t('dashboard.player.clubPage.membersDescription', {
                count: club.members.length,
              })}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {roster.map((member) => {
                const canRemove =
                  isLeader &&
                  member.membershipRole !== 'LEADER' &&
                  member.user.id !== initialUser.id;
                const invited = member.user.status === 'INVITED';
                const isSelf = member.user.id === initialUser.id;
                // Leadership can only pass to someone who has actually arrived:
                // an invited row is an address, not yet a person who can act.
                const canPromote = canRemove && !invited;
                return (
                  <SurfaceCard key={member.id} className="p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-tint)]">
                        {member.membershipRole === 'LEADER' ? (
                          <Crown className="h-4 w-4 text-[#a86712]" />
                        ) : (
                          <UserRound className="h-4 w-4 text-[var(--dash-muted)]" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--dash-text)]">
                          {member.user.fullName}
                          {/* Which row is you. A "Leader" badge only answers
                              "who leads this club" once the reader can also
                              find themselves in the list. */}
                          {isSelf ? (
                            <span className="ml-1.5 text-sm font-normal text-[var(--dash-muted)]">
                              ({copy.you.toLowerCase()})
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            className={member.membershipRole === 'LEADER'
                              ? 'border-[#e4c98f] bg-[#fff9ec] text-[#74551b]'
                              : 'border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]'}
                          >
                            {member.membershipRole === 'LEADER' ? copy.leader : copy.member}
                          </Badge>
                          {invited ? (
                            <Badge className="border-[#e4c98f] bg-[#fff9ec] text-[#74551b]">
                              {copy.invitePending}
                            </Badge>
                          ) : null}
                          {member.roleTitle ? (
                            <span className="text-xs text-[var(--dash-faint)]">{member.roleTitle}</span>
                          ) : null}
                        </div>
                      </div>
                      {canRemove ? (
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          {canPromote ? (
                            <Button
                              type="button"
                              variant="outline"
                              aria-label={`${copy.makeLeader}: ${member.user.fullName}`}
                              disabled={Boolean(busyAction)}
                              onClick={() => setPromoteTarget(member)}
                              className={cn(softButtonClassName, 'min-h-11')}
                            >
                              <Crown className="h-4 w-4" />
                              {copy.makeLeader}
                            </Button>
                          ) : null}
                          {invited ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                aria-label={`${copy.resendInvite}: ${member.user.fullName}`}
                                disabled={Boolean(busyAction)}
                                onClick={() => void resendInvite(member)}
                                className={cn(softButtonClassName, 'min-h-11')}
                              >
                                <MailCheck className="h-4 w-4" />
                                {busyAction === `resend:${member.id}` ? copy.sending : copy.resendInvite}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                aria-label={`${copy.revokeInvite}: ${member.user.fullName}`}
                                disabled={Boolean(busyAction)}
                                onClick={() => void revokeInvite(member)}
                                className="min-h-11 border-[#d7a3a1] bg-[#fff7f6] text-[#9f302b] shadow-none hover:border-[#c2413b] hover:bg-[#fbe9e8] hover:text-[#812622] focus-visible:ring-[#c2413b]/30"
                              >
                                <Trash2 className="h-4 w-4" />
                                {copy.revokeInvite}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              aria-label={`${copy.remove}: ${member.user.fullName}`}
                              disabled={Boolean(busyAction)}
                              onClick={() => void openRemoval(member)}
                              className="min-h-11 border-[#d7a3a1] bg-[#fff7f6] text-[#9f302b] shadow-none hover:border-[#c2413b] hover:bg-[#fbe9e8] hover:text-[#812622] focus-visible:ring-[#c2413b]/30"
                            >
                              <UserMinus className="h-4 w-4" />
                              {copy.remove}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
            {!isLeader ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-[var(--dash-muted)]">
                  <ShieldCheck className="h-4 w-4" />
                  {copy.leaderOnly}
                </p>
                {/* A leader cannot leave — they hand leadership on first — so
                    the command is only offered to the people it works for. */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(busyAction)}
                  onClick={() => void openDeparture()}
                  className="min-h-11 border-[#d7a3a1] bg-[#fff7f6] text-[#9f302b] shadow-none hover:border-[#c2413b] hover:bg-[#fbe9e8] hover:text-[#812622] focus-visible:ring-[#c2413b]/30"
                >
                  <LogOut className="h-4 w-4" />
                  {copy.leaveClub}
                </Button>
              </div>
            ) : null}
          </section>

          {isLeader ? (
            <section id="club-join-requests" tabIndex={-1}>
              <SectionHeading
                eyebrow={copy.eyebrow}
                title={copy.requestsTitle}
                description={copy.requestsDescription}
              />
              <div className="mt-4 space-y-3">
                {club.joinRequests.map((request) => (
                  <SurfaceCard key={request.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-tint)]">
                          <Users className="h-4 w-4 text-[var(--dash-muted)]" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--dash-text)]">
                            {request.user.fullName}
                          </p>
                          <p className="mt-1 text-xs text-[var(--dash-faint)]">
                            {formatDate(request.createdAt, { dateStyle: 'medium' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={Boolean(busyAction)}
                          onClick={() => setRejectTarget(request)}
                          className={cn(softButtonClassName, 'min-h-11 flex-1 sm:flex-none')}
                        >
                          <X className="h-4 w-4" />
                          {busyAction === `reject:${request.id}` ? copy.reviewing : copy.reject}
                        </Button>
                        <Button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => reviewRequest(request.id, 'approve')}
                          className="min-h-11 flex-1 sm:flex-none"
                        >
                          <Check className="h-4 w-4" />
                          {busyAction === `approve:${request.id}` ? copy.reviewing : copy.approve}
                        </Button>
                      </div>
                    </div>
                  </SurfaceCard>
                ))}
                {!club.joinRequests.length ? (
                  <EmptyState title={copy.noRequests} icon={Users} />
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <DashboardModal
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open && !busyAction) setRejectTarget(null);
        }}
        title={t('dashboard.player.clubPage.rejectTitle', { name: rejectTarget?.user.fullName ?? '' })}
        description={copy.rejectDescription}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busyAction)}
              onClick={() => setRejectTarget(null)}
              className={modalSoftButtonClassName}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(busyAction)}
              onClick={() => rejectTarget && void reviewRequest(rejectTarget.id, 'reject')}
              className="border border-[#ad3632] bg-[#b83b36] text-white shadow-none hover:bg-[#9f302b] focus-visible:ring-[#c2413b]/35"
            >
              <X className="h-4 w-4" />
              {busyAction.startsWith('reject:') ? copy.reviewing : copy.reject}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-[#6d5f5c]">{copy.rejectDescription}</p>
      </DashboardModal>

      <DashboardModal
        open={Boolean(kickTarget) || departing}
        onOpenChange={(open) => {
          if (!open && !busyAction) closeRemoval();
        }}
        title={departing
          ? copy.leaveTitle
          : t('dashboard.player.clubPage.removeTitle', { name: kickTarget?.user.fullName ?? '' })}
        description={
          removalImpact?.affectedRegistrations.length
            ? t(
                removalImpact.affectedRegistrations.length === 1
                  ? 'dashboard.player.clubPage.removeAffectedDescriptionOne'
                  : 'dashboard.player.clubPage.removeAffectedDescriptionMany',
                {
                name: departing ? copy.you : kickTarget?.user.fullName ?? '',
                count: removalImpact.affectedRegistrations.length,
                },
              )
            : departing ? copy.leaveDescription : copy.removeDescription
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busyAction)}
              onClick={closeRemoval}
              className={modalSoftButtonClassName}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                Boolean(busyAction) ||
                !removalImpact ||
                !resolutionsComplete ||
                hasBlockedRegistration
              }
              onClick={departing ? leaveClub : removeMember}
              className="border border-[#ad3632] bg-[#b83b36] text-white shadow-none hover:bg-[#9f302b] focus-visible:ring-[#c2413b]/35"
            >
              {departing ? <LogOut className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
              {busyAction.startsWith('remove:')
                ? departing ? copy.leaving : copy.removing
                : departing
                  ? copy.confirmLeave
                  : removalImpact?.affectedRegistrations.length
                    ? copy.resolveAndRemove
                    : copy.confirmRemove}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {removalError ? (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800" role="alert">
              <AlertDescription>{removalError}</AlertDescription>
            </Alert>
          ) : null}

          {impactLoading ? (
            <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-[#6d5f5c]">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              {copy.checkingRegistrations}
            </div>
          ) : null}

          {removalImpact && !removalImpact.affectedRegistrations.length ? (
            <p className="text-sm leading-6 text-[#6d5f5c]">
              {departing ? copy.leaveDescription : copy.removeDescription}
            </p>
          ) : null}

          {removalImpact?.affectedRegistrations.length ? (
            <>
              <div className="flex gap-3 rounded-lg border border-[#e4c98f] bg-[#fff9ec] px-3 py-3 text-sm leading-6 text-[#74551b]">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p>{copy.resolveRegistrationsHint}</p>
              </div>

              <div className="space-y-3">
                {removalImpact.affectedRegistrations.map((registration) => {
                  const resolution = removalResolutions[registration.id];
                  const candidates = replacementCandidates(registration);
                  return (
                    <section
                      key={registration.id}
                      className="rounded-xl border border-[#e7dcd8] bg-[#faf6f3] p-4"
                      aria-labelledby={`affected-registration-${registration.id}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3
                            id={`affected-registration-${registration.id}`}
                            className="font-semibold text-[#2a1f1e]"
                          >
                            {registration.event.title}
                          </h3>
                          <p className="mt-1 text-sm text-[#6d5f5c]">
                            {registration.category.name} ·{' '}
                            {formatDate(registration.event.date, { dateStyle: 'medium' })}
                          </p>
                          <p className="mt-2 text-sm font-medium text-[#334e68]">
                            {registration.owner.fullName} / {registration.teammate.fullName}
                          </p>
                        </div>
                        <RegistrationStatusBadge status={registration.status} />
                      </div>

                      {registration.blockedReason ? (
                        <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <p>
                            {registration.blockedReason === 'EVENT_ONGOING'
                              ? copy.blockedOngoing
                              : copy.blockedBracket}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <DashboardField
                            id={`removal-action-${registration.id}`}
                            label={copy.registrationAction}
                          >
                            <select
                              id={`removal-action-${registration.id}`}
                              value={resolution?.action ?? 'WITHDRAW'}
                              disabled={Boolean(busyAction)}
                              className={selectControlClassName}
                              onChange={(event) => {
                                const action = event.target.value as 'REPLACE' | 'WITHDRAW';
                                setRemovalResolutions((current) => ({
                                  ...current,
                                  [registration.id]: {
                                    action,
                                    replacementUserId:
                                      action === 'REPLACE'
                                        ? current[registration.id]?.replacementUserId ||
                                          candidates[0]?.id ||
                                          ''
                                        : '',
                                  },
                                }));
                              }}
                            >
                              <option value="REPLACE" disabled={!candidates.length}>
                                {copy.replaceInRegistration}
                              </option>
                              <option value="WITHDRAW">{copy.withdrawRegistration}</option>
                            </select>
                          </DashboardField>

                          {resolution?.action === 'REPLACE' ? (
                            <DashboardField
                              id={`replacement-${registration.id}`}
                              label={copy.replacementPlayer}
                            >
                              <select
                                id={`replacement-${registration.id}`}
                                value={resolution.replacementUserId}
                                disabled={Boolean(busyAction)}
                                className={selectControlClassName}
                                onChange={(event) =>
                                  setRemovalResolutions((current) => ({
                                    ...current,
                                    [registration.id]: {
                                      action: 'REPLACE',
                                      replacementUserId: event.target.value,
                                    },
                                  }))
                                }
                              >
                                {candidates.map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.fullName}
                                  </option>
                                ))}
                              </select>
                            </DashboardField>
                          ) : (
                            <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[#edc5c2] bg-[#fff7f6] px-3 text-sm text-[#9f302b]">
                              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {copy.withdrawWarning}
                            </div>
                          )}
                        </div>
                      )}

                      {!registration.blockedReason && resolution?.action === 'REPLACE' ? (
                        <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-[#6d5f5c]">
                          <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {copy.replacementPendingHint}
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </DashboardModal>

      <DashboardModal
        open={Boolean(promoteTarget)}
        onOpenChange={(open) => {
          if (!open && !busyAction) setPromoteTarget(null);
        }}
        title={t('dashboard.player.clubPage.promoteTitle', { name: promoteTarget?.user.fullName ?? '' })}
        description={copy.promoteDescription}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busyAction)}
              onClick={() => setPromoteTarget(null)}
              className={modalSoftButtonClassName}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="red" disabled={Boolean(busyAction)} onClick={transferLeadership}>
              <Crown className="h-4 w-4" />
              {busyAction.startsWith('promote:') ? copy.promoting : copy.confirmPromote}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-[#6d5f5c]">{copy.promoteConsequence}</p>
      </DashboardModal>

      {invitingMember ? (
        <ClubMateInvite
          onClose={() => setInvitingMember(false)}
          onInvited={async ({ name, invited }) => {
            setInvitingMember(false);
            setFeedback(t(
              invited
                ? 'dashboard.player.clubPage.inviteMember.invited'
                : 'dashboard.player.clubPage.inviteMember.added',
              { name },
            ));
            await load();
          }}
        />
      ) : null}

      {club && editingProfile ? (
        <ClubProfileEditor
          club={{
            name: club.name,
            slug: club.slug,
            description: club.description,
            logoUrl: club.logoUrl,
          }}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            setEditingProfile(false);
            setClub({ ...club, ...updated });
            setFeedback(t('dashboard.player.clubPage.editProfile.success', { name: updated.name }));
          }}
        />
      ) : null}
    </PlayerShell>
  );
}
