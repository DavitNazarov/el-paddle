'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import type { PublicUser } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  DashboardShell,
  EmptyState,
  FeedbackBanner,
  RegistrationStatusBadge,
  SectionHeading,
  SidebarLink,
  StatCard,
  SurfaceCard,
  formControlClassName,
  selectControlClassName,
} from '@/components/padel/DashboardUI';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function DashboardClient({ initialUser }: { initialUser: PublicUser }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState('');

  const user = data?.user ?? initialUser;
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

  async function submitRegistration(event: EventDto) {
    const form = eventForm(event);
    setSavingEventId(event.id);
    setMessage('');
    setError('');

    const response = await apiFetch('/api/registrations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        categoryId: form.categoryId,
        ownerPhone: form.ownerPhone,
        teammateEmail: form.teammateEmail,
        teammatePhone: form.teammatePhone,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSavingEventId('');

    if (!response.ok) {
      setError(result.error ?? 'Could not register.');
      return;
    }

    setMessage('Registration sent to admin for review.');
    setForms((current) => ({
      ...current,
      [event.id]: {
        categoryId: event.categories[0]?.id ?? '',
        ownerPhone: '',
        teammateEmail: '',
        teammatePhone: '',
      },
    }));
    await loadDashboard();
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <DashboardShell
      eyebrow="Player dashboard"
      title={user.fullName}
      description="Register teams, track review status, and keep your match record visible from one clean workspace."
      sidebarSubtitle="Member workspace"
      sidebarContent={<DashboardSidebar />}
      mobileNavigation={<MobileDashboardNav />}
      sidebarFooter={
        <div className="rounded-lg border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
            Signed in
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--padel-ivory)]">{user.fullName}</p>
          <p className="mt-1 truncate text-xs text-[var(--padel-muted)]">{user.email}</p>
        </div>
      }
      actions={
        <Button variant="red" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Matches played" value={user.stats.matchesPlayed} icon={Trophy} description="Lifetime tracked matches." />
        <StatCard label="Won" value={user.stats.wins} icon={CheckCircle2} tone="success" description="Confirmed wins." />
        <StatCard label="Lost" value={user.stats.losses} icon={XCircle} tone="danger" description="Recorded losses." />
        <StatCard label="Pending entries" value={registrationCounts.pending} icon={Clock} tone="warning" description="Awaiting admin review." />
      </section>

      <div className="mt-6">
        {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
        {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
      </div>

      <div className="mt-1 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5">
          <SectionHeading
            eyebrow="Upcoming events"
            title="Published entries"
            description="Choose a category, invite your teammate by email, and send the team to admin review."
          />

          {loading ? <EmptyState title="Loading dashboard" description="Fetching published events and registrations." icon={CalendarDays} /> : null}
          {!loading && !data?.events.length ? (
            <EmptyState title="No published events" description="There are no upcoming events accepting entries yet." icon={CalendarDays} />
          ) : null}

          <div className="grid gap-4">
            {(data?.events ?? []).map((event) => {
              const form = eventForm(event);
              const alreadyRegistered = registrationKeys.has(`${event.id}:${form.categoryId}`);
              return (
                <SurfaceCard key={event.id}>
                  <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_0.92fr] md:p-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {event.categories.map((category) => (
                          <Badge key={category.id} variant="outline" className="border-[rgba(19,2,2,0.12)] bg-white text-[rgba(19,2,2,0.7)]">
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-normal text-[var(--padel-ink)]">
                        {event.title}
                      </h3>
                      <div className="mt-4 grid gap-3 text-sm text-[rgba(19,2,2,0.58)]">
                        <span className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-[var(--padel-red)]" />
                          {dateFormatter.format(new Date(event.date))}
                        </span>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[var(--padel-red)]" />
                          {event.location}
                        </span>
                      </div>
                      <p className="mt-5 text-sm leading-6 text-[rgba(19,2,2,0.62)]">
                        {event.description || 'Choose a category and add your teammate by email.'}
                      </p>
                    </div>

                    <div className="space-y-4 md:border-l md:border-[rgba(19,2,2,0.08)] md:pl-5">
                      <DashboardField label="Category" id={`category-${event.id}`}>
                        <select
                          id={`category-${event.id}`}
                          value={form.categoryId}
                          onChange={(item) => updateEventForm(event.id, 'categoryId', item.target.value)}
                          className={selectControlClassName}
                        >
                          {event.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </DashboardField>
                      <DashboardField label="Your phone" id={`phone-${event.id}`}>
                        <Input
                          id={`phone-${event.id}`}
                          type="tel"
                          value={form.ownerPhone}
                          onChange={(item) => updateEventForm(event.id, 'ownerPhone', item.target.value)}
                          placeholder="+995 555 000 000"
                          className={formControlClassName}
                        />
                      </DashboardField>
                      <DashboardField label="Teammate email" id={`teammate-${event.id}`}>
                        <Input
                          id={`teammate-${event.id}`}
                          type="email"
                          value={form.teammateEmail}
                          onChange={(item) => updateEventForm(event.id, 'teammateEmail', item.target.value)}
                          placeholder="teammate@example.com"
                          className={formControlClassName}
                        />
                      </DashboardField>
                      <DashboardField label="Teammate phone" id={`teammate-phone-${event.id}`} hint="Optional">
                        <Input
                          id={`teammate-phone-${event.id}`}
                          type="tel"
                          value={form.teammatePhone}
                          onChange={(item) => updateEventForm(event.id, 'teammatePhone', item.target.value)}
                          placeholder="+995 555 000 000"
                          className={formControlClassName}
                        />
                      </DashboardField>
                      <Button
                        type="button"
                        variant="red"
                        size="lg"
                        disabled={savingEventId === event.id || alreadyRegistered || !form.categoryId}
                        onClick={() => submitRegistration(event)}
                        className="w-full rounded-md"
                      >
                        {alreadyRegistered ? 'Already registered' : savingEventId === event.id ? 'Sending' : 'Register team'}
                      </Button>
                    </div>
                  </CardContent>
                </SurfaceCard>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <SectionHeading
            eyebrow="Registration status"
            title="Your entries"
            description={`${registrations.length} total registrations across published events.`}
          />

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <MiniStatus label="Pending" value={registrationCounts.pending} icon={Clock} tone="warning" />
            <MiniStatus label="Approved" value={registrationCounts.approved} icon={CheckCircle2} tone="success" />
            <MiniStatus label="Declined" value={registrationCounts.declined} icon={XCircle} tone="danger" />
          </div>

          {!loading && !registrations.length ? (
            <EmptyState title="No team registrations" description="Your submitted teams will appear here after you register." icon={Users} />
          ) : null}

          {registrations.length ? (
            <SurfaceCard>
              <CardHeader className="p-5 pb-0">
                <CardTitle className="text-lg">Recent entries</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid gap-4">
                  {registrations.map((registration) => (
                    <div key={registration.id} className="border-b border-[rgba(19,2,2,0.08)] pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[var(--padel-ink)]">{registration.event.title}</h3>
                          <p className="mt-1 text-sm text-[rgba(19,2,2,0.58)]">{registration.category.name}</p>
                        </div>
                        <RegistrationStatusBadge status={registration.status} />
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-sm text-[rgba(19,2,2,0.58)]">
                        <Users className="h-4 w-4 text-[var(--padel-red)]" />
                        {registration.owner.fullName} / {registration.teammate.fullName}
                      </p>
                      {registration.declineReason ? (
                        <p className="mt-3 rounded-md bg-[var(--padel-red)]/8 px-3 py-2 text-sm text-[var(--padel-red)]">
                          {registration.declineReason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </SurfaceCard>
          ) : null}
        </aside>
      </div>
    </DashboardShell>
  );
}

function DashboardSidebar() {
  return (
    <div className="grid gap-1">
      <SidebarLink href="/dashboard" icon={LayoutDashboard} label="Overview" active />
      <SidebarLink href="/" icon={Home} label="Public site" />
    </div>
  );
}

function MobileDashboardNav() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button asChild variant="red" className="min-h-10 rounded-md px-3">
        <Link href="/dashboard">
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </Link>
      </Button>
      <Button asChild variant="outline" className="min-h-10 rounded-md border-[rgba(19,2,2,0.12)] bg-white/72 px-3 text-[var(--padel-ink)]">
        <Link href="/">
          <Home className="h-4 w-4" />
          Home
        </Link>
      </Button>
    </div>
  );
}

function MiniStatus({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    success: 'bg-emerald-700 text-white',
    warning: 'bg-[var(--padel-gold)] text-[var(--padel-ink)]',
    danger: 'bg-[var(--padel-red-2)] text-[var(--padel-ivory)]',
  }[tone];

  return (
    <SurfaceCard>
      <CardContent className="flex items-center gap-4 p-4">
        <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-md', toneClass)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xl font-semibold text-[var(--padel-ink)]">{value}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(19,2,2,0.52)]">{label}</p>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}
