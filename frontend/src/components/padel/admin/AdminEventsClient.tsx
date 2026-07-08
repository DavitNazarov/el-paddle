'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Eye,
  EyeOff,
  MapPin,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
} from '@/components/padel/DashboardUI';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/padel/I18nProvider';
import { AdminShell } from './AdminShell';
import type { CategoryDto, EventDto } from './types';
import { toDatetimeLocalValue } from './utils';

type EventFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

const emptyEventForm = {
  title: '',
  date: '',
  location: '',
  description: '',
  arrivalTime: '',
  categoryIds: [] as string[],
};

export function AdminEventsClient() {
  const { dictionary, t, formatDate } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.eventsPage;
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [arrivalEvent, setArrivalEvent] = useState<EventDto | null>(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [arrivalDraft, setArrivalDraft] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    if (filter === 'PUBLISHED') return events.filter((event) => event.isPublished);
    if (filter === 'DRAFT') return events.filter((event) => !event.isPublished);
    return events;
  }, [events, filter]);

  const counts = useMemo(
    () => ({
      all: events.length,
      published: events.filter((event) => event.isPublished).length,
      draft: events.filter((event) => !event.isPublished).length,
    }),
    [events],
  );

  async function load() {
    setLoading(true);
    const [categoryResponse, eventResponse] = await Promise.all([
      apiFetch('/api/categories', { cache: 'no-store' }),
      apiFetch('/api/events?scope=admin', { cache: 'no-store' }),
    ]);
    const categoryData = (await categoryResponse.json()) as { categories: CategoryDto[] };
    const eventData = (await eventResponse.json()) as { events: EventDto[] };
    setCategories(categoryData.categories ?? []);
    setEvents(eventData.events ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleCategory(categoryId: string) {
    setEventForm((current) => {
      const selected = new Set(current.categoryIds);
      if (selected.has(categoryId)) selected.delete(categoryId);
      else selected.add(categoryId);
      return { ...current, categoryIds: [...selected] };
    });
  }

  function openCreate() {
    setEventForm(emptyEventForm);
    setCreateOpen(true);
  }

  function openArrival(event: EventDto) {
    setArrivalEvent(event);
    setArrivalDraft(toDatetimeLocalValue(event.arrivalTime));
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy('create');
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(eventForm),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.draftCreated);
    setEventForm(emptyEventForm);
    setCreateOpen(false);
    await load();
  }

  async function togglePublish(event: EventDto) {
    setError('');
    setMessage('');
    setBusy(`publish-${event.id}`);
    const response = await apiFetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublished: !event.isPublished }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.updateFailed);
      return;
    }
    setMessage(event.isPublished ? admin.messages.unpublished : admin.messages.published);
    await load();
  }

  async function saveArrivalTime(arrivalTime?: string | null) {
    if (!arrivalEvent) return;
    const draft = arrivalTime !== undefined ? arrivalTime : arrivalDraft;
    setError('');
    setMessage('');
    setBusy(`arrival-${arrivalEvent.id}`);
    const response = await apiFetch(`/api/events/${arrivalEvent.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arrivalTime: draft || null }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.updateFailed);
      return;
    }
    setMessage(admin.events.arrivalTimeUpdated);
    setArrivalEvent(null);
    await load();
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      {!categories.length && !loading ? (
        <SurfaceCard className="mb-6 border-[var(--padel-gold)]/40 bg-[var(--padel-gold)]/10">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--padel-ink)]">{copy.needCategoriesTitle}</h3>
              <p className="mt-1 text-sm text-[rgba(19,2,2,0.62)]">{copy.needCategoriesDescription}</p>
            </div>
            <Button asChild variant="red">
              <Link href="/admin/categories">{copy.goToCategories}</Link>
            </Button>
          </CardContent>
        </SurfaceCard>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'ALL'} count={counts.all} onClick={() => setFilter('ALL')}>
            {copy.filterAll}
          </FilterChip>
          <FilterChip active={filter === 'PUBLISHED'} count={counts.published} onClick={() => setFilter('PUBLISHED')}>
            {admin.events.published}
          </FilterChip>
          <FilterChip active={filter === 'DRAFT'} count={counts.draft} onClick={() => setFilter('DRAFT')}>
            {admin.events.draft}
          </FilterChip>
        </div>
        <Button variant="red" onClick={openCreate} disabled={!categories.length}>
          <Plus className="h-4 w-4" />
          {copy.showCreate}
        </Button>
      </div>

      <SectionHeading title={admin.events.pipelineTitle} description={admin.events.pipelineDescription} />
      <div className="mt-4 grid gap-3">
        {loading ? <EmptyState title={admin.events.loadingTitle} description={admin.events.loadingDescription} icon={CalendarDays} /> : null}
        {!loading && !filteredEvents.length ? (
          <EmptyState
            title={admin.events.noEventsTitle}
            description={admin.events.noEventsDescription}
            icon={CalendarPlus}
            action={
              categories.length ? (
                <Button variant="red" onClick={openCreate}>
                  {copy.showCreate}
                </Button>
              ) : (
                <Button asChild variant="red">
                  <Link href="/admin/categories">{copy.goToCategories}</Link>
                </Button>
              )
            }
          />
        ) : null}

        {filteredEvents.map((event) => {
          const publishBusy = busy === `publish-${event.id}`;
          return (
            <SurfaceCard key={event.id}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={event.isPublished ? 'default' : 'gold'}>
                        {event.isPublished ? admin.events.published : admin.events.draft}
                      </Badge>
                      {event.categories.map((category) => (
                        <Badge key={category.id} variant="outline" className="border-[rgba(19,2,2,0.12)]">
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-[var(--padel-ink)]">{event.title}</h3>
                    <div className="mt-3 grid gap-2 text-sm text-[rgba(19,2,2,0.62)] sm:grid-cols-2">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[var(--padel-red)]" />
                        {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[var(--padel-red)]" />
                        {event.location}
                      </span>
                    </div>
                    {event.arrivalTime ? (
                      <p className="mt-3 text-sm font-medium text-[var(--padel-red)]">
                        {admin.events.arrivalTime}:{' '}
                        {formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    ) : null}
                    {event.description ? (
                      <p className="mt-3 text-sm leading-6 text-[rgba(19,2,2,0.58)]">{event.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button
                      variant={event.isPublished ? 'outline' : 'red'}
                      className={cn('shrink-0', event.isPublished && softButtonClassName)}
                      disabled={publishBusy}
                      onClick={() => togglePublish(event)}
                    >
                      {event.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {publishBusy ? admin.messages.saving : event.isPublished ? admin.events.unpublish : admin.events.publish}
                    </Button>
                    <Button variant="outline" className={softButtonClassName} onClick={() => openArrival(event)}>
                      {copy.arrivalSettings}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </SurfaceCard>
          );
        })}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={admin.events.createEvent}
        description={copy.createDescription}
        size="xl"
        footer={
          <>
            <Button type="button" variant="outline" className={softButtonClassName} onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="create-event-form"
              variant="red"
              disabled={!eventForm.categoryIds.length || busy === 'create'}
            >
              {busy === 'create' ? admin.messages.saving : admin.events.createDraft}
            </Button>
          </>
        }
      >
        <form id="create-event-form" onSubmit={createEvent} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardField label={admin.events.eventTitle} id="event-title">
              <Input
                id="event-title"
                required
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={admin.events.eventPlaceholder}
                className={formControlClassName}
              />
            </DashboardField>
            <DashboardField label={admin.events.date} id="event-date">
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
          <DashboardField label={admin.events.location} id="event-location">
            <Input
              id="event-location"
              required
              value={eventForm.location}
              onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))}
              placeholder={admin.events.locationPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.events.arrivalTime} id="event-arrival-time" hint={admin.events.arrivalTimeHint}>
            <Input
              id="event-arrival-time"
              type="datetime-local"
              value={eventForm.arrivalTime}
              onChange={(event) => setEventForm((current) => ({ ...current, arrivalTime: event.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.events.descriptionLabel} id="event-description" hint={t('common.optional')}>
            <Textarea
              id="event-description"
              value={eventForm.description}
              onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={admin.events.eventDescriptionPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(19,2,2,0.62)]">
              {admin.events.categories}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const selected = eventForm.categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-medium',
                      selected
                        ? 'border-[var(--padel-red)] bg-[var(--padel-red)]/7 text-[var(--padel-red)]'
                        : 'border-[rgba(19,2,2,0.12)] bg-white',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCategory(category.id)}
                      className="h-4 w-4 accent-[var(--padel-red)]"
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(arrivalEvent)}
        onOpenChange={(open) => {
          if (!open) setArrivalEvent(null);
        }}
        title={copy.editArrivalTitle}
        description={copy.editArrivalDescription}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" className={softButtonClassName} onClick={() => setArrivalEvent(null)}>
              {t('common.cancel')}
            </Button>
            {arrivalEvent?.arrivalTime ? (
              <Button
                type="button"
                variant="outline"
                className={softButtonClassName}
                disabled={busy === `arrival-${arrivalEvent.id}`}
                onClick={() => {
                  setArrivalDraft('');
                  void saveArrivalTime(null);
                }}
              >
                {admin.events.clearArrivalTime}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="red"
              disabled={!arrivalEvent || busy === `arrival-${arrivalEvent.id}`}
              onClick={() => saveArrivalTime()}
            >
              {busy?.startsWith('arrival-') ? admin.messages.saving : admin.events.saveArrivalTime}
            </Button>
          </>
        }
      >
        {arrivalEvent ? (
          <DashboardField label={admin.events.arrivalTime} id="modal-arrival-time">
            <Input
              id="modal-arrival-time"
              type="datetime-local"
              value={arrivalDraft}
              onChange={(event) => setArrivalDraft(event.target.value)}
              className={formControlClassName}
            />
          </DashboardField>
        ) : null}
      </DashboardModal>
    </AdminShell>
  );
}
