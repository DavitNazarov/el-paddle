'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  GitBranch,
  LockKeyhole,
  Radio,
  Trophy,
  XCircle,
} from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, MatchDto, OpponentRequestDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice } from '@/components/tournament/TournamentUI';
import { cn } from '@/lib/utils';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import styles from './AdminBracket.module.css';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

const rounds: MatchDto['round'][] = ['ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

function pairLabel(bracket: BracketDto, match: MatchDto, side: 'A' | 'B', locale: 'ka' | 'en') {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const source = bracket.matches.find((candidate) => candidate.nextMatchId === match.id && candidate.nextMatchSlot === side);
  const copy = tournamentCopy[locale].publicEvent;
  return source ? fillTemplate(copy.winnerOfMatch, { number: source.matchNumber }) : copy.toBeDetermined;
}

function activeRounds(matches: MatchDto[]) {
  const present = new Set(matches.map((match) => match.round));
  return rounds.filter((round) => present.has(round));
}

function winnerSide(match: MatchDto): 'A' | 'B' | null {
  if (match.winnerEntryId && match.winnerEntryId === match.participantAEntryId) return 'A';
  if (match.winnerEntryId && match.winnerEntryId === match.participantBEntryId) return 'B';
  if (match.status !== 'COMPLETED' || match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? 'A' : 'B';
}

export function AdminBracketClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [bracketToLock, setBracketToLock] = useState<BracketDto | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
      apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch(`/api/admin/events/${eventId}/opponent-requests`, { cache: 'no-store' }),
    ]);
    const eventData = await a.json() as { event?: EventDto; error?: string };
    const bracketData = await b.json() as { brackets?: BracketDto[]; error?: string };
    const requestData = await c.json() as { requests?: OpponentRequestDto[] };
    if (!a.ok || !b.ok) setError(eventData.error ?? bracketData.error ?? copy.admin.bracket.loadError);
    else {
      setEvent(eventData.event ?? null);
      setBrackets(bracketData.brackets ?? []);
      setRequests(requestData.requests ?? []);
    }
  }, [copy.admin.bracket.loadError, eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(categoryId: string) {
    setBusy(`create-${categoryId}`);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets`, {
      method: 'POST',
      body: JSON.stringify({ categoryId, commandId: createCommandId('bracket-create') }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.createError);
    else void load();
  }

  async function command(bracket: BracketDto, action: 'generate' | 'lock' | 'publication') {
    setBusy(`${action}-${bracket.id}`);
    setError('');
    const approvedRequestIds = requests
      .filter((request) => request.categoryId === bracket.categoryId && ['APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN'].includes(request.status))
      .map((request) => request.id);
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets/${bracket.id}/${action === 'publication' ? 'publication' : action}`, {
      method: action === 'publication' ? 'PATCH' : 'POST',
      body: JSON.stringify({
        expectedVersion: bracket.version,
        commandId: createCommandId(`bracket-${action}`),
        requestIds: approvedRequestIds,
        published: !bracket.publishedAt,
      }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.commandError);
    else { if (action === 'lock') setBracketToLock(null); void load(); }
  }

  const matchCount = brackets.reduce((total, bracket) => total + bracket.matches.length, 0);
  const completedMatchCount = brackets.reduce(
    (total, bracket) => total + bracket.matches.filter((match) => match.status === 'COMPLETED').length,
    0,
  );

  return (
    <AdminShell
      title={copy.admin.bracket.title}
      description={copy.admin.bracket.description}
      eyebrow={copy.admin.common.eyebrow}
    >
      <div className={styles.pageToolbar}>
        <BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink>
        {event ? <span className={styles.eventName}>{event.title}</span> : null}
      </div>

      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      {!event && !error ? <BracketSkeleton /> : null}

      {event ? (
        <>
          <BracketOverview
            bracketCount={brackets.length}
            categoryCount={event.categories.length}
            completedMatchCount={completedMatchCount}
            isCompleted={isCompleted}
            matchCount={matchCount}
            publishedCount={brackets.filter((bracket) => bracket.publishedAt).length}
          />

          {isCompleted ? (
            <div className={styles.readOnlyNotice} role="status">
              <span className={styles.noticeIcon}><LockKeyhole aria-hidden="true" /></span>
              <div>
                <p>{copy.admin.bracket.completedTitle}</p>
                <span>{copy.admin.bracket.completedDescription}</span>
              </div>
            </div>
          ) : null}

          {event.categories.length > 1 ? (
            <nav className={styles.categoryNav} aria-label={copy.admin.bracket.categoryNav}>
              {event.categories.map((category) => {
                const bracket = brackets.find((item) => item.categoryId === category.id);
                return (
                  <a key={category.id} href={`#category-${category.id}`}>
                    <span>{category.name}</span>
                    <span className={styles.categoryCount}>{bracket?.matches.length ?? 0}</span>
                  </a>
                );
              })}
            </nav>
          ) : null}

          <div className={styles.categoryList}>
            {event.categories.map((category) => {
              const bracket = brackets.find((item) => item.categoryId === category.id);
              if (!bracket) {
                return (
                  <section id={`category-${category.id}`} key={category.id} className={styles.bracketPanel} aria-labelledby={`category-title-${category.id}`}>
                    <BracketHeader
                      titleId={`category-title-${category.id}`}
                      title={category.name}
                      description={isCompleted ? copy.admin.bracket.noBracketCategory : copy.admin.bracket.createCategory}
                      badges={<MetaPill icon={<GitBranch />}>{copy.admin.bracket.notCreated}</MetaPill>}
                      actions={isCompleted ? undefined : (
                        <CommandButton tone="primary" busy={busy === `create-${category.id}`} onClick={() => create(category.id)} className={styles.primaryAction}>
                          {copy.admin.bracket.createBracket}
                        </CommandButton>
                      )}
                    />
                    <EmptyTournamentState title={copy.admin.bracket.notCreatedTitle} detail={copy.admin.bracket.notCreatedDetail} />
                  </section>
                );
              }

              return (
                <BracketCategory
                  key={bracket.id}
                  bracket={bracket}
                  categoryName={category.name}
                  busy={busy}
                  isCompleted={isCompleted}
                  onCommand={command}
                  onLock={setBracketToLock}
                />
              );
            })}
          </div>
          <DashboardModal
            open={Boolean(bracketToLock)}
            onOpenChange={(open) => { if (!open && !busy) setBracketToLock(null); }}
            title={copy.admin.bracket.lockTitle}
            description={bracketToLock ? `${bracketToLock.eventCategory.category.name} · ${fillTemplate(copy.admin.bracket.generation, { number: bracketToLock.generation })}` : undefined}
            size="md"
            footer={
              <ModalFormFooter
                onCancel={() => setBracketToLock(null)}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { if (bracketToLock) void command(bracketToLock, 'lock'); }}
                busy={Boolean(bracketToLock && busy === `lock-${bracketToLock.id}`)}
                submitLabel={copy.admin.bracket.lock}
              />
            }
          >
            <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{copy.admin.bracket.lockNote}</p>
          </DashboardModal>
        </>
      ) : null}
    </AdminShell>
  );
}

function BracketOverview({
  bracketCount,
  categoryCount,
  completedMatchCount,
  isCompleted,
  matchCount,
  publishedCount,
}: {
  bracketCount: number;
  categoryCount: number;
  completedMatchCount: number;
  isCompleted: boolean;
  matchCount: number;
  publishedCount: number;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  const items = [
    { label: copy.categories, value: categoryCount },
    { label: copy.drawsReady, value: `${bracketCount}/${categoryCount}` },
    { label: copy.matchesComplete, value: matchCount ? `${completedMatchCount}/${matchCount}` : '—' },
    { label: copy.published, value: `${publishedCount}/${bracketCount || categoryCount}` },
  ];

  return (
    <section className={styles.overview} aria-label={copy.overview}>
      <div className={styles.overviewIntro}>
        <span className={styles.overviewIcon}>{isCompleted ? <Trophy aria-hidden="true" /> : <GitBranch aria-hidden="true" />}</span>
        <div>
          <p>{isCompleted ? copy.finalDraw : copy.workspace}</p>
          <span>{isCompleted ? copy.readOnly : copy.workspaceDescription}</span>
        </div>
      </div>
      <dl className={styles.overviewStats}>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BracketCategory({
  bracket,
  busy,
  categoryName,
  isCompleted,
  onCommand,
  onLock,
}: {
  bracket: BracketDto;
  busy: string;
  categoryName: string;
  isCompleted: boolean;
  onCommand: (bracket: BracketDto, action: 'generate' | 'lock' | 'publication') => void;
  onLock: (bracket: BracketDto) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const final = bracket.matches.find((match) => match.round === 'FINAL');
  const finalWinner = final ? winnerSide(final) : null;
  const champion = final && finalWinner ? pairLabel(bracket, final, finalWinner, locale) : null;

  return (
    <section
      id={`category-${bracket.categoryId}`}
      className={styles.bracketPanel}
      aria-labelledby={`category-title-${bracket.categoryId}`}
    >
      <BracketHeader
        titleId={`category-title-${bracket.categoryId}`}
        title={categoryName}
        description={`${fillTemplate(copy.admin.bracket.generation, { number: bracket.generation })} · ${fillTemplate(copy.admin.bracket.entryDraw, { count: bracket.size })}`}
        badges={(
          <>
            <MetaPill tone={bracket.status === 'COMPLETED' ? 'success' : 'neutral'} icon={bracket.status === 'COMPLETED' ? <CheckCircle2 /> : <CircleDot />}>
              {tournamentStatus(locale, bracket.status)}
            </MetaPill>
            <MetaPill tone={bracket.publishedAt ? 'info' : 'neutral'} icon={bracket.publishedAt ? <Check /> : <Clock3 />}>
              {bracket.publishedAt ? copy.admin.bracket.published : copy.admin.bracket.notPublished}
            </MetaPill>
          </>
        )}
        champion={champion}
        actions={isCompleted ? undefined : (
          <>
            <CommandButton
              tone="primary"
              busy={busy === `generate-${bracket.id}`}
              disabled={bracket.status !== 'DRAFT'}
              onClick={() => onCommand(bracket, 'generate')}
              className={styles.primaryAction}
            >
              {copy.admin.bracket.generateDraft}
            </CommandButton>
            <CommandButton
              busy={busy === `lock-${bracket.id}`}
              disabled={bracket.status !== 'DRAFT' || !bracket.matches.length}
              onClick={() => onLock(bracket)}
            >
              {copy.admin.bracket.lockShort}
            </CommandButton>
            <CommandButton
              busy={busy === `publication-${bracket.id}`}
              disabled={bracket.status === 'DRAFT'}
              onClick={() => onCommand(bracket, 'publication')}
            >
              {bracket.publishedAt ? copy.admin.bracket.unpublish : copy.admin.bracket.publish}
            </CommandButton>
          </>
        )}
      />

      {bracket.matches.length ? (
        <BracketBoard bracket={bracket} />
      ) : (
        <EmptyTournamentState title={copy.admin.bracket.empty} detail={copy.admin.bracket.emptyDetail} />
      )}
    </section>
  );
}

function BracketHeader({
  actions,
  badges,
  champion,
  description,
  title,
  titleId,
}: {
  actions?: ReactNode;
  badges: ReactNode;
  champion?: string | null;
  description: string;
  title: string;
  titleId: string;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  return (
    <header className={styles.bracketHeader}>
      <div className={styles.headerIdentity}>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className={styles.metaRow}>{badges}</div>
      </div>
      <div className={styles.headerAside}>
        {champion ? (
          <div className={styles.champion}>
            <Trophy aria-hidden="true" />
            <span><small>{copy.champion}</small>{champion}</span>
          </div>
        ) : null}
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
    </header>
  );
}

function MetaPill({ children, icon, tone = 'neutral' }: { children: ReactNode; icon: ReactNode; tone?: 'neutral' | 'success' | 'info' }) {
  return (
    <span className={styles.metaPill} data-tone={tone}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

function BracketBoard({ bracket }: { bracket: BracketDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const visibleRounds = activeRounds(bracket.matches);
  const firstRoundMatches = bracket.matches.filter((match) => match.round === visibleRounds[0]);
  const rowCount = Math.max(firstRoundMatches.length * 2, 2);
  const boardStyle = {
    '--round-count': visibleRounds.length,
    '--row-count': rowCount,
  } as CSSProperties;

  return (
    <div className={styles.boardRegion}>
      <div className={styles.boardHint}>
        <span>{copy.admin.bracket.progression}</span>
        <span>{copy.admin.bracket.progressionDescription}</span>
      </div>
      <div className={styles.board} style={boardStyle}>
        {visibleRounds.map((round, roundIndex) => {
          const roundMatches = bracket.matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.roundPosition - b.roundPosition);
          const rowSpan = Math.max(2 ** (roundIndex + 1), 2);
          return (
            <section key={round} className={styles.round} aria-labelledby={`${bracket.id}-${round}`}>
              <header className={styles.roundHeader}>
                <span>{String(roundIndex + 1).padStart(2, '0')}</span>
                <h3 id={`${bracket.id}-${round}`}>{tournamentRound(locale, round)}</h3>
                <small>{roundMatches.length} {roundMatches.length === 1 ? copy.common.match.toLowerCase() : copy.common.matches}</small>
              </header>
              <div className={styles.roundMatches}>
                {roundMatches.map((match, matchIndex) => {
                  const slotStyle = {
                    gridRow: `${matchIndex * rowSpan + 1} / span ${rowSpan}`,
                  } as CSSProperties;
                  return (
                    <div
                      key={match.id}
                      className={cn(styles.matchSlot, roundIndex < visibleRounds.length - 1 && styles.matchAdvances)}
                      style={slotStyle}
                    >
                      <MatchCard bracket={bracket} match={match} />
                      {roundIndex < visibleRounds.length - 1 ? <ChevronRight className={styles.advanceIcon} aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({ bracket, match }: { bracket: BracketDto; match: MatchDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const winner = winnerSide(match);
  return (
    <article className={styles.matchCard} data-status={match.status.toLowerCase()} aria-label={`${copy.common.match} ${match.matchNumber}, ${tournamentStatus(locale, match.status)}`}>
      <header className={styles.matchHeader}>
        <span>{copy.common.match} {match.matchNumber}</span>
        <MatchStatus status={match.status} />
      </header>
      <div className={styles.participants}>
        <ParticipantRow
          label={pairLabel(bracket, match, 'A', locale)}
          score={match.status === 'COMPLETED' ? match.scoreA : null}
          side="A"
          winner={winner === 'A'}
        />
        <ParticipantRow
          label={pairLabel(bracket, match, 'B', locale)}
          score={match.status === 'COMPLETED' ? match.scoreB : null}
          side="B"
          winner={winner === 'B'}
        />
      </div>
    </article>
  );
}

function ParticipantRow({ label, score, side, winner }: { label: string; score: number | null; side: 'A' | 'B'; winner: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const pending = label === copy.publicEvent.toBeDetermined || label.includes(copy.common.winner);
  return (
    <div className={cn(styles.participant, winner && styles.winner, pending && styles.pendingParticipant)}>
      <span className={styles.sideLabel}>{side}</span>
      <span className={styles.pairName}>{label}</span>
      {winner ? <Check className={styles.winnerCheck} aria-label={copy.common.winner} /> : null}
      <span className={styles.score}>{score ?? '—'}</span>
    </div>
  );
}

function MatchStatus({ status }: { status: MatchDto['status'] }) {
  const { locale } = useI18n();
  const icons: Record<MatchDto['status'], ReactNode> = {
    COMPLETED: <CheckCircle2 aria-hidden="true" />,
    IN_PROGRESS: <Radio aria-hidden="true" />,
    READY: <CircleDot aria-hidden="true" />,
    PENDING: <Clock3 aria-hidden="true" />,
    CANCELLED: <XCircle aria-hidden="true" />,
  };
  return (
    <span className={styles.matchStatus} data-status={status.toLowerCase()}>
      {icons[status]}
      {tournamentStatus(locale, status)}
    </span>
  );
}

function BracketSkeleton() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  return (
    <div className={styles.skeleton} role="status" aria-label={copy.loading}>
      <div className={styles.skeletonOverview} />
      <div className={styles.skeletonPanel}>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
