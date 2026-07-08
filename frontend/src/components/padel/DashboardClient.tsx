'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import type { PublicUser } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  DashboardModal,
  DashboardShell,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  RegistrationStatusBadge,
  SectionHeading,
  SidebarLink,
  SurfaceCard,
  formControlClassName,
  selectControlClassName,
  softButtonClassName,
} from '@/components/padel/DashboardUI';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from './I18nProvider';

type CategoryDto = {
  id: string;
  name: string;
  description: string;
};

type EventDto = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime?: string | null;
  categories: CategoryDto[];
};

type RegistrationDto = {
  id: string;
  event: { id: string; title: string; date: string; location: string };
  category: CategoryDto;
  owner: PublicUser;
  teammate: PublicUser;
  ownerPhone: string;
  teammatePhone: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  declineReason: string;
};

type DashboardData = {
  user: PublicUser;
  events: EventDto[];
  registrations: RegistrationDto[];
};

type FormState = {
  categoryId: string;
  ownerPhone: string;
  teammateEmail: string;
  teammatePhone: string;
};

type StatusFilter = 'ALL' | RegistrationDto['status'];

export function DashboardClient({ initialUser }: { initialUser: PublicUser }) {
  const router = useRouter();
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;
  const [data, setData] = useState<DashboardData | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [registerEvent, setRegisterEvent] = useState<EventDto | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState('');

  const user = data?.user ?? initialUser;
  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const registrations = useMemo(() => data?.registrations ?? [], [data?.registrations]);
  const registrationCounts = useMemo(
    () => ({
      pending: registrations.filter((registration) => registration.status === 'PENDING').length,
      approved: registrations.filter((registration) => registration.status === 'APPROVED').length,
      declined: registrations.filter((registration) => registration.status === 'DECLINED').length,
    }),
    [registrations],
  );
  const registrationKeys = useMemo(
    () =>
      new Set(
        registrations.map(
          (registration) => `${registration.event.id}:${registration.category.id}`,
        ),
      ),
    [registrations],
  );
  const filteredRegistrations = useMemo(() => {
    if (statusFilter === 'ALL') return registrations;
    return registrations.filter((registration) => registration.status === statusFilter);
  }, [registrations, statusFilter]);
  const nextEvent = events[0] ?? null;
  const winRate =
    user.stats.matchesPlayed > 0
      ? Math.round((user.stats.wins / user.stats.matchesPlayed) * 100)
      : null;

  async function loadDashboard(showLoading = true) {
    if (showLoading) setLoading(true);
    const response = await apiFetch('/api/dashboard', { cache: 'no-store' });
    if (response.status === 401) {
      router.push('/login?next=/dashboard');
      return;
    }
    const nextData = (await response.json()) as DashboardData;
    setData(nextData);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard(false);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function eventForm(event: EventDto) {
    return {
      categoryId: forms[event.id]?.categoryId || event.categories[0]?.id || '',
      ownerPhone: forms[event.id]?.ownerPhone ?? '',
      teammateEmail: forms[event.id]?.teammateEmail ?? '',
      teammatePhone: forms[event.id]?.teammatePhone ?? '',
    };
  }

  function updateEventForm(eventId: string, field: keyof FormState, value: string) {
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? '',
        teammateEmail: current[eventId]?.teammateEmail ?? '',
        teammatePhone: current[eventId]?.teammatePhone ?? '',
        [field]: value,
      },
    }));
  }

  function openRegister(event: EventDto) {
    setError('');
    const preferredCategory =
      event.categories.find((category) => !registrationKeys.has(`${event.id}:${category.id}`))?.id ||
      event.categories[0]?.id ||
      '';
    setForms((current) => ({
      ...current,
      [event.id]: {
        categoryId: preferredCategory,
        ownerPhone: current[event.id]?.ownerPhone ?? '',
        teammateEmail: current[event.id]?.teammateEmail ?? '',
        teammatePhone: current[event.id]?.teammatePhone ?? '',
      },
    }));
    setRegisterEvent(event);
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registerEvent) return;
    const form = eventForm(registerEvent);
    setSavingEventId(registerEvent.id);
    setMessage('');
    setError('');

    const response = await apiFetch('/api/registrations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: registerEvent.id,
        categoryId: form.categoryId,
        ownerPhone: form.ownerPhone,
        teammateEmail: form.teammateEmail,
        teammatePhone: form.teammatePhone,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSavingEventId('');

    if (!response.ok) {
      setError(result.error ?? t('dashboard.player.messages.registerError'));
      return;
    }

    setMessage(t('dashboard.player.messages.registerSuccess'));
    setForms((current) => ({
      ...current,
      [registerEvent.id]: {
        categoryId: registerEvent.categories[0]?.id ?? '',
        ownerPhone: '',
        teammateEmail: '',
        teammatePhone: '',
      },
    }));
    setRegisterEvent(null);
    setStatusFilter('PENDING');
    await loadDashboard();
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const activeForm = registerEvent ? eventForm(registerEvent) : null;
  const alreadyRegisteredForActive =
    registerEvent && activeForm
      ? registrationKeys.has(`${registerEvent.id}:${activeForm.categoryId}`)
      : false;
  const canSubmit =
    Boolean(registerEvent) &&
    Boolean(activeForm?.categoryId) &&
    Boolean(activeForm?.ownerPhone.trim()) &&
    Boolean(activeForm?.teammateEmail.trim()) &&
    !alreadyRegisteredForActive &&
    savingEventId !== registerEvent?.id;

  return (
    <DashboardShell
      eyebrow={player.eyebrow}
      title={t('dashboard.player.greeting', { name: user.name || user.fullName })}
      description={player.description}
      sidebarSubtitle={player.sidebarSubtitle}
      sidebarContent={<DashboardSidebar pendingCount={registrationCounts.pending} />}
      mobileNavigation={<MobileDashboardNav pendingCount={registrationCounts.pending} />}
      sidebarFooter={
        <div className="rounded-lg border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
            {player.signedIn}
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--padel-ivory)]">{user.fullName}</p>
          <p className="mt-1 truncate text-xs text-[var(--padel-muted)]">{user.email}</p>
        </div>
      }
      actions={
        <Button variant="outline" className={softButtonClassName} onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('common.logout')}
        </Button>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SurfaceCard className="overflow-hidden bg-[linear-gradient(135deg,#fffaf2_0%,#f4ebe0_55%,#efe3d3_100%)]">
          <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_auto] lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--padel-red)]">
                {player.nextEventLabel}
              </p>
              {loading ? (
                <p className="mt-3 text-sm text-[rgba(19,2,2,0.58)]">{player.sections.loadingDescription}</p>
              ) : nextEvent ? (
                <>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--padel-ink)] sm:text-3xl">
                    {nextEvent.title}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[rgba(19,2,2,0.62)]">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[var(--padel-red)]" />
                      {formatDate(nextEvent.date, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[var(--padel-red)]" />
                      {nextEvent.location}
                    </span>
                    {nextEvent.arrivalTime ? (
                      <span className="inline-flex items-center gap-2 font-medium text-[var(--padel-red)]">
                        <Clock className="h-4 w-4" />
                        {player.arrivalLabel}:{' '}
                        {formatDate(nextEvent.arrivalTime, { timeStyle: 'short' })}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--padel-ink)]">{player.sections.noEventsTitle}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[rgba(19,2,2,0.6)]">
                    {player.sections.noEventsDescription}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge variant="secondary">{t('dashboard.player.openEventsLabel', { count: events.length })}</Badge>
              {nextEvent ? (
                <Button variant="red" onClick={() => openRegister(nextEvent)}>
                  {player.buttons.openRegister}
                </Button>
              ) : null}
              {registrationCounts.pending > 0 ? (
                <Button
                  variant="outline"
                  className={softButtonClassName}
                  onClick={() => {
                    setStatusFilter('PENDING');
                    document.getElementById('player-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {player.buttons.viewEntries}
                  <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-[var(--padel-gold)]/30 px-1.5 text-xs">
                    {registrationCounts.pending}
                  </span>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(19,2,2,0.5)]">
              {player.recordLabel}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <RecordStat label={player.stats[0][0]} value={user.stats.matchesPlayed} />
              <RecordStat label={player.stats[1][0]} value={user.stats.wins} tone="success" />
              <RecordStat label={player.stats[2][0]} value={user.stats.losses} tone="danger" />
            </div>
            <div className="mt-5 flex items-center justify-between rounded-md bg-[#faf6ee] px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm text-[rgba(19,2,2,0.62)]">
                <Trophy className="h-4 w-4 text-[var(--padel-gold-deep)]" />
                {player.stats[1][0]}
              </span>
              <span className="text-sm font-semibold text-[var(--padel-ink)]">
                {winRate === null ? '—' : `${winRate}%`}
              </span>
            </div>
          </CardContent>
        </SurfaceCard>
      </section>

      <div className="mt-6">
        {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
        {error && !registerEvent ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
      </div>

      <div className="mt-1 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5">
          <SectionHeading
            eyebrow={player.sections.upcomingEyebrow}
            title={player.sections.upcomingTitle}
            description={player.sections.upcomingDescription}
          />

          {loading ? (
            <EmptyState title={player.sections.loadingTitle} description={player.sections.loadingDescription} icon={CalendarDays} />
          ) : null}
          {!loading && !events.length ? (
            <EmptyState title={player.sections.noEventsTitle} description={player.sections.noEventsDescription} icon={CalendarDays} />
          ) : null}

          <div className="grid gap-4">
            {events.map((event) => {
              const registeredCategories = event.categories.filter((category) =>
                registrationKeys.has(`${event.id}:${category.id}`),
              );
              const allCategoriesRegistered =
                event.categories.length > 0 && registeredCategories.length === event.categories.length;
              const openCategoryCount = event.categories.length - registeredCategories.length;

              return (
                <SurfaceCard key={event.id} className="transition-colors hover:border-[rgba(140,25,22,0.18)]">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.categories.map((category) => {
                            const registered = registrationKeys.has(`${event.id}:${category.id}`);
                            return (
                              <Badge
                                key={category.id}
                                variant={registered ? 'default' : 'outline'}
                                className={cn(
                                  !registered && 'border-[rgba(19,2,2,0.12)] bg-white text-[rgba(19,2,2,0.7)]',
                                )}
                              >
                                {category.name}
                              </Badge>
                            );
                          })}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold tracking-normal text-[var(--padel-ink)]">
                          {event.title}
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[rgba(19,2,2,0.58)]">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--padel-red)]" />
                            {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-[var(--padel-red)]" />
                            {event.location}
                          </span>
                          {event.arrivalTime ? (
                            <span className="inline-flex items-center gap-2 font-medium text-[var(--padel-red)]">
                              <Clock className="h-4 w-4 shrink-0" />
                              {player.arrivalLabel}:{' '}
                              {formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          ) : null}
                        </div>
                        {event.description ? (
                          <p className="mt-4 max-w-2xl text-sm leading-6 text-[rgba(19,2,2,0.62)]">
                            {event.description}
                          </p>
                        ) : null}
                        {registeredCategories.length ? (
                          <p className="mt-4 text-sm font-medium text-emerald-800">
                            {t('dashboard.player.registeredIn', {
                              categories: registeredCategories.map((category) => category.name).join(', '),
                            })}
                          </p>
                        ) : (
                          <p className="mt-4 text-sm text-[rgba(19,2,2,0.52)]">
                            {t('dashboard.player.availableCategories', { count: event.categories.length })}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pt-1">
                        {allCategoriesRegistered ? (
                          <Button variant="outline" className={cn(softButtonClassName, 'w-full sm:w-auto')} disabled>
                            <CheckCircle2 className="h-4 w-4" />
                            {player.buttons.alreadyRegistered}
                          </Button>
                        ) : (
                          <Button variant="red" className="w-full sm:w-auto" onClick={() => openRegister(event)}>
                            {player.buttons.openRegister}
                            {openCategoryCount > 0 && openCategoryCount < event.categories.length ? (
                              <span className="ml-1 text-xs opacity-90">({openCategoryCount})</span>
                            ) : null}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </SurfaceCard>
              );
            })}
          </div>
        </section>

        <aside id="player-entries" className="space-y-5 scroll-mt-28">
          <SectionHeading
            eyebrow={player.sections.statusEyebrow}
            title={player.sections.statusTitle}
            description={t('dashboard.player.sections.statusDescription', { count: registrations.length })}
          />

          <div className="flex flex-wrap gap-2">
            <FilterChip active={statusFilter === 'ALL'} count={registrations.length} onClick={() => setStatusFilter('ALL')}>
              {player.filters.all}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'PENDING'}
              count={registrationCounts.pending}
              onClick={() => setStatusFilter('PENDING')}
            >
              {player.mini.pending}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'APPROVED'}
              count={registrationCounts.approved}
              onClick={() => setStatusFilter('APPROVED')}
            >
              {player.mini.approved}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'DECLINED'}
              count={registrationCounts.declined}
              onClick={() => setStatusFilter('DECLINED')}
            >
              {player.mini.declined}
            </FilterChip>
          </div>

          {!loading && !registrations.length ? (
            <EmptyState title={player.sections.noTeamsTitle} description={player.sections.noTeamsDescription} icon={Users} />
          ) : null}

          {!loading && registrations.length > 0 && !filteredRegistrations.length ? (
            <EmptyState
              title={player.sections.emptyFilterTitle}
              description={player.sections.emptyFilterDescription}
              icon={ListChecks}
              action={
                <Button variant="outline" className={softButtonClassName} onClick={() => setStatusFilter('ALL')}>
                  {player.filters.all}
                </Button>
              }
            />
          ) : null}

          {filteredRegistrations.length ? (
            <div className="grid gap-3">
              {filteredRegistrations.map((registration) => (
                <SurfaceCard key={registration.id}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[var(--padel-ink)]">{registration.event.title}</h3>
                        <p className="mt-1 text-sm text-[rgba(19,2,2,0.58)]">{registration.category.name}</p>
                      </div>
                      <RegistrationStatusBadge status={registration.status} />
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[rgba(19,2,2,0.58)]">
                      <p className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--padel-red)]" />
                        {formatDate(registration.event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-[var(--padel-red)]" />
                        <span className="truncate">
                          {registration.owner.fullName} / {registration.teammate.fullName}
                        </span>
                      </p>
                    </div>
                    {registration.declineReason ? (
                      <p className="mt-3 rounded-md bg-[var(--padel-red)]/8 px-3 py-2 text-sm text-[var(--padel-red)]">
                        {registration.declineReason}
                      </p>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <DashboardModal
        open={Boolean(registerEvent)}
        onOpenChange={(open) => {
          if (!open) setRegisterEvent(null);
        }}
        title={player.registerModal.title}
        description={
          registerEvent
            ? `${player.registerModal.description} · ${registerEvent.title}`
            : player.registerModal.description
        }
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" className={softButtonClassName} onClick={() => setRegisterEvent(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="player-register-form" variant="red" disabled={!canSubmit}>
              {alreadyRegisteredForActive
                ? player.buttons.alreadyRegistered
                : savingEventId === registerEvent?.id
                  ? player.buttons.sending
                  : player.buttons.registerTeam}
            </Button>
          </>
        }
      >
        {registerEvent && activeForm ? (
          <form id="player-register-form" onSubmit={submitRegistration} className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
            ) : null}
            {alreadyRegisteredForActive ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {player.buttons.alreadyRegistered}
              </div>
            ) : null}
            <DashboardField label={player.fields.category} id={`category-${registerEvent.id}`}>
              <select
                id={`category-${registerEvent.id}`}
                value={activeForm.categoryId}
                onChange={(item) => updateEventForm(registerEvent.id, 'categoryId', item.target.value)}
                className={selectControlClassName}
              >
                {registerEvent.categories.map((category) => {
                  const registered = registrationKeys.has(`${registerEvent.id}:${category.id}`);
                  return (
                    <option key={category.id} value={category.id} disabled={registered}>
                      {category.name}
                      {registered ? ` · ${player.buttons.alreadyRegistered}` : ''}
                    </option>
                  );
                })}
              </select>
            </DashboardField>
            <div className="grid gap-4 sm:grid-cols-2">
              <DashboardField label={player.fields.yourPhone} id={`phone-${registerEvent.id}`}>
                <Input
                  id={`phone-${registerEvent.id}`}
                  type="tel"
                  required
                  value={activeForm.ownerPhone}
                  onChange={(item) => updateEventForm(registerEvent.id, 'ownerPhone', item.target.value)}
                  placeholder="+995 555 000 000"
                  className={formControlClassName}
                />
              </DashboardField>
              <DashboardField label={player.fields.teammatePhone} id={`teammate-phone-${registerEvent.id}`} hint={t('common.optional')}>
                <Input
                  id={`teammate-phone-${registerEvent.id}`}
                  type="tel"
                  value={activeForm.teammatePhone}
                  onChange={(item) => updateEventForm(registerEvent.id, 'teammatePhone', item.target.value)}
                  placeholder="+995 555 000 000"
                  className={formControlClassName}
                />
              </DashboardField>
            </div>
            <DashboardField label={player.fields.teammateEmail} id={`teammate-${registerEvent.id}`}>
              <Input
                id={`teammate-${registerEvent.id}`}
                type="email"
                required
                value={activeForm.teammateEmail}
                onChange={(item) => updateEventForm(registerEvent.id, 'teammateEmail', item.target.value)}
                placeholder="teammate@example.com"
                className={formControlClassName}
              />
            </DashboardField>
          </form>
        ) : null}
      </DashboardModal>
    </DashboardShell>
  );
}

function RecordStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const valueClass = {
    neutral: 'text-[var(--padel-ink)]',
    success: 'text-emerald-700',
    danger: 'text-[var(--padel-red)]',
  }[tone];

  return (
    <div>
      <p className={cn('text-2xl font-semibold', valueClass)}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(19,2,2,0.48)]">{label}</p>
    </div>
  );
}

function DashboardSidebar({ pendingCount }: { pendingCount: number }) {
  const { dictionary } = useI18n();
  const sidebar = dictionary.dashboard.player.sidebar;

  return (
    <div className="grid gap-1">
      <SidebarLink href="/dashboard" icon={LayoutDashboard} label={sidebar.overview} active />
      <button
        type="button"
        onClick={() => document.getElementById('player-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="dashboard-sidebar-button inline-flex h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm font-semibold text-[var(--padel-muted)] transition-colors hover:bg-white/8 hover:text-[var(--padel-ivory)]"
      >
        <ListChecks className="h-4 w-4" />
        <span className="dashboard-sidebar-label flex-1 text-left">{sidebar.entries}</span>
        {pendingCount > 0 ? (
          <span className="dashboard-sidebar-label rounded-full bg-[var(--padel-gold)] px-1.5 text-[11px] font-bold text-[var(--padel-ink)]">
            {pendingCount}
          </span>
        ) : null}
      </button>
      <SidebarLink href="/" icon={Home} label={sidebar.publicSite} />
    </div>
  );
}

function MobileDashboardNav({ pendingCount }: { pendingCount: number }) {
  const { dictionary, t } = useI18n();
  const sidebar = dictionary.dashboard.player.sidebar;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button asChild variant="red" className="min-h-11 rounded-md px-2">
        <Link href="/dashboard">
          <LayoutDashboard className="h-4 w-4" />
          <span className="truncate">{sidebar.overview}</span>
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(softButtonClassName, 'relative min-h-11 rounded-md px-2')}
        onClick={() => document.getElementById('player-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      >
        <ListChecks className="h-4 w-4" />
        <span className="truncate">{sidebar.entries}</span>
        {pendingCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--padel-red)] px-1 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        ) : null}
      </Button>
      <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md px-2')}>
        <Link href="/">
          <Home className="h-4 w-4" />
          <span className="truncate">{t('common.home')}</span>
        </Link>
      </Button>
    </div>
  );
}
