'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Tags,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type { PublicUser } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardShell,
  EmptyState,
  FeedbackBanner,
  RegistrationStatusBadge,
  SectionHeading,
  StatCard,
  SurfaceCard,
  formControlClassName,
  mobileTabTriggerClassName,
  sidebarTabTriggerClassName,
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
  isPublished: boolean;
  categories: CategoryDto[];
};

type RegistrationDto = {
  id: string;
  event: { title: string; date: string };
  category: CategoryDto;
  owner: PublicUser;
  teammate: PublicUser;
  ownerPhone: string;
  teammatePhone: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  declineReason: string;
};

type ClubDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  members: {
    id: string;
    roleTitle: string;
    user: PublicUser;
  }[];
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const adminTabs = [
  { value: 'events', label: 'Events', icon: CalendarDays },
  { value: 'registrations', label: 'Registrations', icon: ClipboardList },
  { value: 'clubs', label: 'Clubs', icon: Building2 },
];

export function AdminClient() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    location: '',
    description: '',
    categoryIds: [] as string[],
  });
  const [clubForm, setClubForm] = useState({ name: '', slug: '', description: '', logoUrl: '' });
  const [memberForm, setMemberForm] = useState<Record<string, { email: string; roleTitle: string }>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const counts = useMemo(
    () => ({
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
      published: events.filter((item) => item.isPublished).length,
    }),
    [events, registrations],
  );

  async function loadAdmin(showLoading = true) {
    if (showLoading) setLoading(true);
    const [categoryResponse, eventResponse, registrationResponse, clubResponse] = await Promise.all([
      apiFetch('/api/categories', { cache: 'no-store' }),
      apiFetch('/api/events?scope=admin', { cache: 'no-store' }),
      apiFetch('/api/admin/registrations', { cache: 'no-store' }),
      apiFetch('/api/admin/clubs', { cache: 'no-store' }),
    ]);

    const categoryData = (await categoryResponse.json()) as { categories: CategoryDto[] };
    const eventData = (await eventResponse.json()) as { events: EventDto[] };
    const registrationData = (await registrationResponse.json()) as { registrations: RegistrationDto[] };
    const clubData = (await clubResponse.json()) as { clubs: ClubDto[] };
    setCategories(categoryData.categories ?? []);
    setEvents(eventData.events ?? []);
    setRegistrations(registrationData.registrations ?? []);
    setClubs(clubData.clubs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdmin(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate('/api/categories', categoryForm, 'Category created.');
    setCategoryForm({ name: '', description: '' });
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate('/api/events', eventForm, 'Draft event created.');
    setEventForm({ title: '', date: '', location: '', description: '', categoryIds: [] });
  }

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate('/api/admin/clubs', clubForm, 'Club created.');
    setClubForm({ name: '', slug: '', description: '', logoUrl: '' });
  }

  async function mutate(url: string, body: unknown, success: string) {
    setError('');
    setMessage('');
    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? 'Action failed.');
      return;
    }
    setMessage(success);
    await loadAdmin();
  }

  async function togglePublish(event: EventDto) {
    setError('');
    setMessage('');
    const response = await apiFetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublished: !event.isPublished }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? 'Could not update event.');
      return;
    }
    setMessage(event.isPublished ? 'Event unpublished.' : 'Event published.');
    await loadAdmin();
  }

  async function setRegistrationStatus(registration: RegistrationDto, status: RegistrationDto['status']) {
    const declineReason =
      status === 'DECLINED'
        ? window.prompt('Decline reason')?.trim() ?? ''
        : '';
    if (status === 'DECLINED' && !declineReason) return;

    setError('');
    setMessage('');
    const response = await apiFetch(`/api/admin/registrations/${registration.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, declineReason }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? 'Could not update registration.');
      return;
    }
    setMessage('Registration status updated and email sent.');
    await loadAdmin();
  }

  async function addClubMember(club: ClubDto) {
    const form = memberForm[club.id] ?? { email: '', roleTitle: '' };
    setError('');
    setMessage('');
    const response = await apiFetch(`/api/admin/clubs/${club.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? 'Could not add member.');
      return;
    }
    setMessage('Club member added.');
    setMemberForm((current) => ({ ...current, [club.id]: { email: '', roleTitle: '' } }));
    await loadAdmin();
  }

  function toggleCategory(categoryId: string) {
    setEventForm((current) => {
      const selected = new Set(current.categoryIds);
      if (selected.has(categoryId)) selected.delete(categoryId);
      else selected.add(categoryId);
      return { ...current, categoryIds: [...selected] };
    });
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <Tabs defaultValue="events">
      <DashboardShell
        eyebrow="Admin dashboard"
        title="Tournament operations"
        description="Create event inventory, review team registrations, and maintain clubs from one focused control room."
        sidebarSubtitle="Admin workspace"
        sidebarContent={<AdminTabList />}
        mobileNavigation={<AdminTabList mobile />}
        sidebarFooter={
          <div className="rounded-lg border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
              Live snapshot
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <SnapshotValue label="Events" value={events.length} />
              <SnapshotValue label="Clubs" value={clubs.length} />
              <SnapshotValue label="Pending" value={counts.pending} />
              <SnapshotValue label="Published" value={counts.published} />
            </div>
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
          <StatCard label="Pending review" value={counts.pending} icon={Clock} tone="warning" description="Teams waiting for approval." />
          <StatCard label="Approved teams" value={counts.approved} icon={CheckCircle2} tone="success" description="Confirmed registrations." />
          <StatCard label="Published events" value={counts.published} icon={CalendarDays} description="Visible on the public schedule." />
          <StatCard label="Declined" value={counts.declined} icon={XCircle} tone="danger" description="Registrations declined by admin." />
        </section>

        <div className="mt-6">
          {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
          {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
        </div>

        <TabsContent value="events" className="mt-0 space-y-6">
          <SectionHeading
            eyebrow="Event setup"
            title="Build tournament inventory"
            description="Start with reusable categories, then create draft events and publish them when entries are ready."
          />

          <div className="grid gap-5 lg:grid-cols-[0.84fr_1.16fr]">
            <SurfaceCard>
              <CardHeader className="p-5 pb-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tags className="h-5 w-5 text-[var(--padel-red)]" />
                  Create category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={createCategory} className="space-y-4">
                  <DashboardField label="Name" id="category-name">
                    <Input
                      id="category-name"
                      required
                      value={categoryForm.name}
                      onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Advanced mixed"
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <DashboardField label="Description" id="category-description" hint="Optional">
                    <Textarea
                      id="category-description"
                      value={categoryForm.description}
                      onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Skill level, rules, or eligibility notes."
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <Button variant="red" className="w-full">
                    <Plus className="h-4 w-4" />
                    Save category
                  </Button>
                </form>
              </CardContent>
            </SurfaceCard>

            <SurfaceCard>
              <CardHeader className="p-5 pb-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarPlus className="h-5 w-5 text-[var(--padel-red)]" />
                  Create event
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={createEvent} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <DashboardField label="Title" id="event-title">
                      <Input
                        id="event-title"
                        required
                        value={eventForm.title}
                        onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Saturday Open"
                        className={formControlClassName}
                      />
                    </DashboardField>
                    <DashboardField label="Date" id="event-date">
                      <Input
                        id="event-date"
                        required
                        type="datetime-local"
                        value={eventForm.date}
                        onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                        className={formControlClassName}
                      />
                    </DashboardField>
                  </div>
                  <DashboardField label="Location" id="event-location">
                    <Input
                      id="event-location"
                      required
                      value={eventForm.location}
                      onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))}
                      placeholder="El Padel Arena"
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <DashboardField label="Description" id="event-description" hint="Optional">
                    <Textarea
                      id="event-description"
                      value={eventForm.description}
                      onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Short public-facing entry details."
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <fieldset>
                    <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(19,2,2,0.62)]">
                      Categories
                    </legend>
                    {categories.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className={cn(
                              'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-[rgba(19,2,2,0.12)] bg-white px-3 text-sm font-medium transition-colors',
                              eventForm.categoryIds.includes(category.id) && 'border-[var(--padel-red)] bg-[var(--padel-red)]/7 text-[var(--padel-red)]',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={eventForm.categoryIds.includes(category.id)}
                              onChange={() => toggleCategory(category.id)}
                              className="h-4 w-4 accent-[var(--padel-red)]"
                            />
                            {category.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No categories yet" description="Create at least one category before drafting an event." icon={Tags} />
                    )}
                  </fieldset>
                  <Button variant="red" className="w-full" disabled={!categories.length}>
                    <CalendarPlus className="h-4 w-4" />
                    Create draft event
                  </Button>
                </form>
              </CardContent>
            </SurfaceCard>
          </div>

          <SurfaceCard>
            <CardContent className="p-5">
              <SectionHeading
                title="Event pipeline"
                description="Draft and published events, ordered by tournament date."
                actions={<Badge variant="secondary">{events.length} total</Badge>}
              />
              <div className="mt-5 grid gap-3">
                {loading ? <EmptyState title="Loading events" description="Fetching the latest admin schedule." icon={CalendarDays} /> : null}
                {!loading && !events.length ? <EmptyState title="No events yet" description="Create a draft event to start accepting teams." icon={CalendarPlus} /> : null}
                {events.map((event) => (
                  <article key={event.id} className="rounded-lg border border-[rgba(19,2,2,0.08)] bg-[#fbf7ef] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={event.isPublished ? 'default' : 'gold'}>
                            {event.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                          <span className="text-sm text-[rgba(19,2,2,0.55)]">
                            {dateFormatter.format(new Date(event.date))}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-[var(--padel-ink)]">{event.title}</h3>
                        <p className="mt-1 text-sm text-[rgba(19,2,2,0.6)]">{event.location}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {event.categories.map((category) => (
                            <Badge key={category.id} variant="outline" className="border-[rgba(19,2,2,0.12)] text-[rgba(19,2,2,0.68)]">
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant={event.isPublished ? 'outline' : 'red'}
                        className={event.isPublished ? 'border-[rgba(19,2,2,0.12)] bg-white text-[var(--padel-ink)] hover:bg-[#f7efe3]' : ''}
                        onClick={() => togglePublish(event)}
                      >
                        {event.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {event.isPublished ? 'Unpublish' : 'Publish'}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="registrations" className="mt-0 space-y-6">
          <SectionHeading
            eyebrow="Approvals"
            title="Registration review"
            description="Review teammate details and move each entry through pending, approved, or declined states."
          />

          {!loading && !registrations.length ? (
            <EmptyState title="No registrations yet" description="Approved public events will send new team entries here." icon={ClipboardList} />
          ) : (
            <SurfaceCard>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[rgba(19,2,2,0.08)] hover:bg-transparent">
                      <TableHead className="text-[rgba(19,2,2,0.56)]">Event</TableHead>
                      <TableHead className="text-[rgba(19,2,2,0.56)]">Team</TableHead>
                      <TableHead className="text-[rgba(19,2,2,0.56)]">Status</TableHead>
                      <TableHead className="text-right text-[rgba(19,2,2,0.56)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-[rgba(19,2,2,0.6)]">
                          Loading registrations...
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {registrations.map((registration) => (
                      <TableRow key={registration.id} className="border-[rgba(19,2,2,0.08)] hover:bg-[#fbf7ef]">
                        <TableCell className="min-w-[220px]">
                          <div className="font-semibold text-[var(--padel-ink)]">{registration.event.title}</div>
                          <div className="mt-1 text-sm text-[rgba(19,2,2,0.56)]">
                            {registration.category.name} · {dateFormatter.format(new Date(registration.event.date))}
                          </div>
                          {registration.declineReason ? (
                            <div className="mt-2 text-sm text-[var(--padel-red)]">Reason: {registration.declineReason}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          <div className="text-sm text-[var(--padel-ink)]">
                            {registration.owner.fullName}
                            <span className="text-[rgba(19,2,2,0.46)]"> / </span>
                            {registration.teammate.fullName}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[rgba(19,2,2,0.56)]">
                            {registration.owner.email} · {registration.teammate.email}
                          </div>
                          <div className="text-xs leading-5 text-[rgba(19,2,2,0.56)]">
                            {registration.ownerPhone} · {registration.teammatePhone || 'No teammate phone'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RegistrationStatusBadge status={registration.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="red" onClick={() => setRegistrationStatus(registration, 'APPROVED')}>
                              <UserCheck className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRegistrationStatus(registration, 'DECLINED')}>
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[rgba(19,2,2,0.12)] bg-white text-[var(--padel-ink)] hover:bg-[#f7efe3]"
                              onClick={() => setRegistrationStatus(registration, 'PENDING')}
                            >
                              Pending
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </SurfaceCard>
          )}
        </TabsContent>

        <TabsContent value="clubs" className="mt-0 space-y-6">
          <SectionHeading
            eyebrow="Club directory"
            title="Manage clubs and staff"
            description="Create public club pages and attach existing users as visible members."
          />

          <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <SurfaceCard>
              <CardHeader className="p-5 pb-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-[var(--padel-red)]" />
                  Create club
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={createClub} className="space-y-4">
                  <DashboardField label="Club name" id="club-name">
                    <Input
                      id="club-name"
                      required
                      value={clubForm.name}
                      onChange={(event) => setClubForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="El Padel Saburtalo"
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <DashboardField label="Slug" id="club-slug" hint="Optional">
                    <Input
                      id="club-slug"
                      value={clubForm.slug}
                      onChange={(event) => setClubForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="el-padel-saburtalo"
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <DashboardField label="Logo URL" id="club-logo" hint="Optional">
                    <Input
                      id="club-logo"
                      type="url"
                      value={clubForm.logoUrl}
                      onChange={(event) => setClubForm((current) => ({ ...current, logoUrl: event.target.value }))}
                      placeholder="https://..."
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <DashboardField label="Description" id="club-description" hint="Optional">
                    <Textarea
                      id="club-description"
                      value={clubForm.description}
                      onChange={(event) => setClubForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Short public profile for the club page."
                      className={formControlClassName}
                    />
                  </DashboardField>
                  <Button variant="red" className="w-full">
                    <Users className="h-4 w-4" />
                    Save club
                  </Button>
                </form>
              </CardContent>
            </SurfaceCard>

            <div className="grid gap-4">
              {loading ? <EmptyState title="Loading clubs" description="Fetching the latest club directory." icon={Building2} /> : null}
              {!loading && !clubs.length ? <EmptyState title="No clubs yet" description="Create a club profile to start adding visible members." icon={Building2} /> : null}
              {clubs.map((club) => {
                const form = memberForm[club.id] ?? { email: '', roleTitle: '' };
                return (
                  <SurfaceCard key={club.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--padel-ink)]">{club.name}</h3>
                          <Link href={`/clubs/${club.slug}`} className="mt-1 inline-flex text-sm font-medium text-[var(--padel-red)] hover:underline">
                            /clubs/{club.slug}
                          </Link>
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgba(19,2,2,0.58)]">
                            {club.description || 'No public description yet.'}
                          </p>
                        </div>
                        <Badge variant="secondary">{club.members.length} members</Badge>
                      </div>

                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void addClubMember(club);
                        }}
                        className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <Input
                          value={form.email}
                          onChange={(event) => setMemberForm((current) => ({ ...current, [club.id]: { ...form, email: event.target.value } }))}
                          placeholder="user@email.com"
                          className={formControlClassName}
                        />
                        <Input
                          value={form.roleTitle}
                          onChange={(event) => setMemberForm((current) => ({ ...current, [club.id]: { ...form, roleTitle: event.target.value } }))}
                          placeholder="Role title"
                          className={formControlClassName}
                        />
                        <Button variant="red">
                          <Plus className="h-4 w-4" />
                          Add member
                        </Button>
                      </form>

                      {club.members.length ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {club.members.map((member) => (
                            <Badge key={member.id} variant="outline" className="border-[rgba(19,2,2,0.12)] bg-white text-[rgba(19,2,2,0.72)]">
                              {member.user.fullName}
                              {member.roleTitle ? ` · ${member.roleTitle}` : ''}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </SurfaceCard>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </DashboardShell>
    </Tabs>
  );
}

function AdminTabList({ mobile = false }: { mobile?: boolean }) {
  return (
    <TabsList
      className={cn(
        'h-auto bg-transparent p-0',
        mobile ? 'grid grid-cols-3 gap-1 rounded-lg bg-[var(--padel-ink)] p-1' : 'grid w-full gap-1',
      )}
    >
      {adminTabs.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          title={item.label}
          className={mobile ? mobileTabTriggerClassName : sidebarTabTriggerClassName}
        >
          <item.icon className="h-4 w-4" />
          <span className="dashboard-sidebar-label">{item.label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

function SnapshotValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-[var(--padel-ivory)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--padel-muted)]">{label}</p>
    </div>
  );
}
