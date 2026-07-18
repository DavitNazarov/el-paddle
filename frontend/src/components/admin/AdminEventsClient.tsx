'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Eye,
  EyeOff,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  MetaRow,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { AdminShell } from './AdminShell';
import type { CategoryDto, EventDto } from '@/types/admin';
import { toDatetimeLocalValue } from '@/lib/utils/dates';

type EventFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'DRAFT';

type EventBucket = Exclude<EventFilter, 'ALL'>;

type EventFormState = {
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime: string;
  participationFee: string;
  bankAccountIban: string;
  bankAccountReceiver: string;
  categoryIds: string[];
};

const emptyEventForm: EventFormState = {
  title: '',
  date: '',
  location: '',
  description: '',
  arrivalTime: '',
  participationFee: '',
  bankAccountIban: '',
  bankAccountReceiver: '',
  categoryIds: [],
};

function formFromEvent(event: EventDto): EventFormState {
  return {
    title: event.title,
    date: toDatetimeLocalValue(event.date),
    location: event.location,
    description: event.description ?? '',
    arrivalTime: toDatetimeLocalValue(event.arrivalTime),
    participationFee: String(event.participationFee),
    bankAccountIban: event.bankAccountIban,
    bankAccountReceiver: event.bankAccountReceiver,
    categoryIds: event.categories.map((category) => category.id),
  };
}

function isEventFormReady(form: EventFormState) {
  const iban = form.bankAccountIban.replace(/\s+/g, '').toUpperCase();
  return (
    form.title.trim().length >= 3 &&
    Boolean(form.date) &&
    Boolean(form.location.trim()) &&
    form.categoryIds.length > 0 &&
    form.participationFee !== '' &&
    Number(form.participationFee) >= 0 &&
    form.bankAccountReceiver.trim().length >= 2 &&
    /^GE\d{2}[A-Z]{2}\d{16}$/.test(iban)
  );
}

function eventBucket(event: EventDto): EventBucket {
  if (event.status === 'COMPLETED') return 'COMPLETED';
  if (!event.isPublished) return 'DRAFT';
  return 'UPCOMING';
}

function compareEvents(a: EventDto, b: EventDto) {
  const bucketOrder: Record<EventBucket, number> = {
    UPCOMING: 0,
    DRAFT: 1,
    COMPLETED: 2,
  };
  const aBucket = eventBucket(a);
  const bBucket = eventBucket(b);
  const bucketDifference = bucketOrder[aBucket] - bucketOrder[bBucket];
  if (bucketDifference) return bucketDifference;

  const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
  return aBucket === 'COMPLETED' ? -dateDifference : dateDifference;
}

export function AdminEventsClient() {
  const { dictionary, t, formatDate } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.eventsPage;
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDto | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventDto | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(emptyEventForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const matchingEvents = filter === 'ALL'
      ? events
      : events.filter((event) => eventBucket(event) === filter);
    return [...matchingEvents].sort(compareEvents);
  }, [events, filter]);

  const counts = useMemo(
    () => ({
      all: events.length,
      upcoming: events.filter((event) => eventBucket(event) === 'UPCOMING').length,
      completed: events.filter((event) => eventBucket(event) === 'COMPLETED').length,
      draft: events.filter((event) => eventBucket(event) === 'DRAFT').length,
    }),
    [events],
  );

  const formOpen = createOpen || Boolean(editingEvent);
  const formMode = editingEvent ? 'edit' : 'create';

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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleCategory(categoryId: string) {
    setEventForm((current) => {
      const selected = new Set(current.categoryIds);
      if (selected.has(categoryId)) selected.delete(categoryId);
      else selected.add(categoryId);
      return { ...current, categoryIds: [...selected] };
    });
  }

  function closeForm() {
    setCreateOpen(false);
    setEditingEvent(null);
    setEventForm(emptyEventForm);
  }

  function openCreate() {
    setEditingEvent(null);
    setEventForm(emptyEventForm);
    setCreateOpen(true);
  }

  function openEdit(event: EventDto) {
    setCreateOpen(false);
    setEditingEvent(event);
    setEventForm(formFromEvent(event));
  }

  async function submitEventForm(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError('');
    setMessage('');
    setBusy(formMode);

    const payload = {
      title: eventForm.title,
      date: eventForm.date,
      location: eventForm.location,
      description: eventForm.description,
      arrivalTime: eventForm.arrivalTime || null,
      participationFee: Number(eventForm.participationFee),
      bankAccountIban: eventForm.bankAccountIban.replace(/\s+/g, '').toUpperCase(),
      bankAccountReceiver: eventForm.bankAccountReceiver.trim(),
      categoryIds: eventForm.categoryIds,
    };

    const response = editingEvent
      ? await apiFetch(`/api/events/${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? (editingEvent ? admin.messages.updateFailed : admin.messages.actionFailed));
      return;
    }

    setMessage(editingEvent ? admin.messages.eventUpdated : admin.messages.draftCreated);
    closeForm();
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

  async function confirmDeleteEvent() {
    if (!deletingEvent) return;
    setError('');
    setMessage('');
    const busyKey = `delete-${deletingEvent.id}`;
    setBusy(busyKey);
    const response = await apiFetch(`/api/events/${deletingEvent.id}`, { method: 'DELETE' });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      setDeletingEvent(null);
      return;
    }
    setMessage(admin.messages.eventDeleted);
    setDeletingEvent(null);
    await load();
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      {!categories.length && !loading ? (
        <SurfaceCard featured className="mb-6">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--padel-ivory)]">{copy.needCategoriesTitle}</h3>
              <p className="mt-1 text-sm text-[rgba(213,201,177,0.55)]">{copy.needCategoriesDescription}</p>
            </div>
            <Button asChild variant="red" className="rounded-md">
              <Link href="/admin/categories">{copy.goToCategories}</Link>
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'ALL'} count={counts.all} onClick={() => setFilter('ALL')}>
            {copy.filterAll}
          </FilterChip>
          <FilterChip active={filter === 'UPCOMING'} count={counts.upcoming} onClick={() => setFilter('UPCOMING')}>
            {copy.filterUpcoming}
          </FilterChip>
          <FilterChip active={filter === 'COMPLETED'} count={counts.completed} onClick={() => setFilter('COMPLETED')}>
            {copy.filterCompleted}
          </FilterChip>
          <FilterChip active={filter === 'DRAFT'} count={counts.draft} onClick={() => setFilter('DRAFT')}>
            {copy.filterDrafts}
          </FilterChip>
        </div>
        <Button variant="red" className="rounded-md" onClick={openCreate} disabled={!categories.length}>
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
                <Button variant="red" className="rounded-md" onClick={openCreate}>
                  {copy.showCreate}
                </Button>
              ) : (
                <Button asChild variant="red" className="rounded-md">
                  <Link href="/admin/categories">{copy.goToCategories}</Link>
                </Button>
              )
            }
          />
        ) : null}

        {filteredEvents.map((event, index) => {
          const publishBusy = busy === `publish-${event.id}`;
          return (
            <Reveal key={event.id} delay={Math.min(index * 0.04, 0.2)}>
              <SurfaceCard>
                <div className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            'border-transparent',
                            event.status === 'COMPLETED'
                              ? 'bg-slate-600 text-white'
                              : event.status === 'ONGOING'
                                ? 'bg-amber-500 text-[var(--padel-ink)]'
                                : event.status === 'REGISTRATION_CLOSED'
                                  ? 'bg-orange-700 text-white'
                                  : 'bg-emerald-700 text-white',
                          )}
                        >
                          {admin.events.statuses[event.status]}
                        </Badge>
                        <Badge
                          className={
                            event.isPublished
                              ? 'border-transparent bg-emerald-600/90 text-[var(--padel-ivory)]'
                              : 'border-[var(--padel-gold)]/40 bg-[var(--padel-gold)]/20 text-[var(--padel-gold-2)]'
                          }
                        >
                          {event.isPublished ? admin.events.published : admin.events.draft}
                        </Badge>
                        {event.categories.map((category) => (
                          <Badge
                            key={category.id}
                            className="border-[rgba(213,201,177,0.18)] bg-transparent text-[rgba(213,201,177,0.7)]"
                          >
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="font-display mt-3 text-xl font-semibold text-[var(--padel-ivory)]">{event.title}</h3>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                        <MetaRow icon={CalendarDays}>
                          {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                        </MetaRow>
                        <MetaRow icon={MapPin}>{event.location}</MetaRow>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[var(--padel-gold)]">
                        {admin.events.feeLabel}: {event.participationFee} GEL
                      </p>
                      <p className="mt-1 text-sm text-[rgba(213,201,177,0.65)]">
                        {admin.events.receiverLabel}:{' '}
                        <span className="text-[var(--padel-ivory)]">{event.bankAccountReceiver}</span>
                      </p>
                      <p className="mt-1 text-sm text-[rgba(213,201,177,0.65)]">
                        {admin.events.ibanLabel}:{' '}
                        <span className="font-mono tracking-wide text-[var(--padel-ivory)]">
                          {event.bankAccountIban}
                        </span>
                      </p>
                      {event.arrivalTime ? (
                        <p className="mt-2 text-sm font-medium text-[var(--padel-gold)]">
                          {admin.events.arrivalTime}:{' '}
                          {formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      ) : null}
                      {event.description ? (
                        <p className="mt-3 text-sm leading-6 text-[rgba(213,201,177,0.55)]">{event.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Button asChild variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                        <Link href={`/admin/events/${event.id}/registrations`}>
                          <ClipboardList className="h-4 w-4" />
                          {copy.registrations}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                        <Link href={`/admin/events/${event.id}`}>Manage tournament</Link>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn(softButtonClassName, 'rounded-md')}
                        onClick={() => openEdit(event)}
                      >
                        <Pencil className="h-4 w-4" />
                        {copy.edit}
                      </Button>
                      {event.isPublished ? (
                        <Button
                          variant="outline"
                          className={cn('shrink-0 rounded-md', softButtonClassName)}
                          disabled={publishBusy}
                          onClick={() => togglePublish(event)}
                        >
                          <EyeOff className="h-4 w-4" />
                          {publishBusy ? admin.messages.saving : admin.events.unpublish}
                        </Button>
                      ) : (
                        <Button
                          variant="red"
                          className="shrink-0 rounded-md"
                          disabled={publishBusy}
                          onClick={() => togglePublish(event)}
                        >
                          <Eye className="h-4 w-4" />
                          {publishBusy ? admin.messages.saving : admin.events.publish}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="shrink-0 rounded-md border-red-900/70 bg-transparent text-red-400 hover:border-red-800 hover:bg-red-950/50 hover:text-red-300 lg:mt-2"
                        onClick={() => setDeletingEvent(event)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {copy.delete}
                      </Button>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </Reveal>
          );
        })}
      </div>

      <DashboardModal
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
        title={formMode === 'edit' ? copy.editTitle : admin.events.createEvent}
        description={formMode === 'edit' ? copy.editDescription : copy.createDescription}
        size="xl"
        footer={
          <ModalFormFooter
            formId="event-form"
            onCancel={closeForm}
            cancelLabel={t('common.cancel')}
            busy={busy === formMode}
            disabled={!isEventFormReady(eventForm)}
            submitLabel={
              busy === formMode
                ? admin.messages.saving
                : formMode === 'edit'
                  ? copy.saveChanges
                  : admin.events.createDraft
            }
          />
        }
      >
        <form id="event-form" onSubmit={submitEventForm} className="space-y-4">
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
          <div className="grid gap-4 md:grid-cols-2">
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
            <DashboardField
              label={admin.events.participationFee}
              id="event-fee"
              hint={admin.events.participationFeeHint}
            >
              <Input
                id="event-fee"
                required
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={eventForm.participationFee}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, participationFee: event.target.value }))
                }
                placeholder={admin.events.participationFeePlaceholder}
                className={formControlClassName}
              />
            </DashboardField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardField
              label={admin.events.bankAccountReceiver}
              id="event-receiver"
              hint={admin.events.bankAccountReceiverHint}
            >
              <Input
                id="event-receiver"
                required
                value={eventForm.bankAccountReceiver}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, bankAccountReceiver: event.target.value }))
                }
                placeholder={admin.events.bankAccountReceiverPlaceholder}
                className={formControlClassName}
              />
            </DashboardField>
            <DashboardField
              label={admin.events.bankAccountIban}
              id="event-iban"
              hint={admin.events.bankAccountIbanHint}
            >
              <Input
                id="event-iban"
                required
                value={eventForm.bankAccountIban}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, bankAccountIban: event.target.value }))
                }
                placeholder={admin.events.bankAccountIbanPlaceholder}
                className={cn(formControlClassName, 'font-mono tracking-wide uppercase')}
                autoComplete="off"
                spellCheck={false}
              />
            </DashboardField>
          </div>
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
            <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(88,16,16,0.62)]">
              {admin.events.categories}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => {
                const selected = eventForm.categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors',
                      selected
                        ? 'border-[#2f6fed] bg-[#eaf1ff] text-[#1f55b5]'
                        : 'border-[#d3deea] bg-white text-[#334b65] hover:border-[#aebfd1] hover:bg-[#f4f7fb]',
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
        open={Boolean(deletingEvent)}
        onOpenChange={(open) => {
          if (!open) setDeletingEvent(null);
        }}
        title={copy.deleteTitle}
        description={
          deletingEvent
            ? copy.deleteDescription.replace('{name}', deletingEvent.title)
            : copy.deleteDescription
        }
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setDeletingEvent(null)}
            cancelLabel={t('common.cancel')}
            busy={Boolean(deletingEvent && busy === `delete-${deletingEvent.id}`)}
            submitType="button"
            submitVariant="destructive"
            onSubmitClick={() => {
              void confirmDeleteEvent();
            }}
            submitLabel={
              deletingEvent && busy === `delete-${deletingEvent.id}`
                ? admin.messages.saving
                : copy.confirmDelete
            }
          />
        }
      >
        <p className="text-sm leading-6 text-[#60748b]">{copy.deleteWarning}</p>
      </DashboardModal>
    </AdminShell>
  );
}
