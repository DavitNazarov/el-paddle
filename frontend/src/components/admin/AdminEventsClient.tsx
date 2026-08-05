'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackBanner, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { Notice } from '@/components/shared/dashboard/Feedback';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { useViewer } from '@/hooks/useViewer';
import { useEventOperations } from '@/hooks/useEventOperations';
import { AdminShell } from './AdminShell';
import { AdminEventBoard } from './AdminEventBoard';
import { DirectoryToolbar } from './directory/DirectoryToolbar';
import { rowActionClassName } from './directory/DirectoryTable';
import { ConfirmModal, StepperEditorModal } from './directory/DirectoryModals';
import { EventForm } from './events/EventForm';
import {
  EVENT_FACET_VALUES,
  EVENT_STEPS,
  clampEventStep,
  emptyEventForm,
  eventPayload,
  eventReader,
  firstInvalidEventStep,
  formFromEvent,
  isEventFormValid,
  isEventStepValid,
  sortEvents,
  validateEventForm,
  type EventFormState,
  type EventStepId,
} from './events/eventsModel';
import { ALL_FACET, emptyQuery, facetOptions, filterRows, type DirectoryQuery } from './directory/directoryModel';
import type { CategoryDto, EventDto } from '@/types/admin';

/**
 * The season, as a board: every event carrying where it has reached and what it
 * is waiting on, over the same `AdminEventBoard` the role home and the event
 * pickers use. Only the row controls differ, and only admins get them —
 * organisers run events handed to them and cannot create, edit, publish or
 * delete one.
 */
export function AdminEventsClient() {
  const { dictionary, locale, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.eventsPage;
  const eventsCopy = tournamentCopy[locale].admin.events;
  const formCopy = tournamentCopy[locale].admin.form;
  const dir = tournamentCopy[locale].admin.directory;

  /** Each step is named by the question it asks, so the rail reads as the form does. */
  const stepLabels: Record<EventStepId, string> = {
    identity: eventsCopy.sectionIdentity,
    when: eventsCopy.sectionWhen,
    money: eventsCopy.sectionMoney,
    categories: eventsCopy.sectionCategories,
  };

  const { viewer } = useViewer();
  const canManageEvents = viewer?.role === 'ADMIN';
  const { operations } = useEventOperations();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [query, setQuery] = useState<DirectoryQuery>(emptyQuery);
  const [editing, setEditing] = useState<EventDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<EventDto | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyEventForm);
  const [step, setStep] = useState(0);
  /**
   * The steps the reader has been through. A step states whether it is finished
   * or unfinished only once they have left it, and saving marks them all — so a
   * fresh form is never a wall of red, and nothing already walked past stays
   * quietly broken.
   */
  const [visitedSteps, setVisitedSteps] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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

  const visible = useMemo(() => filterRows(events, query, eventReader), [events, query]);
  const facets = useMemo(
    () =>
      facetOptions(events, query, eventReader, EVENT_FACET_VALUES, (value) => {
        if (value === ALL_FACET) return dir.all;
        if (value === 'UPCOMING') return eventsCopy.bucketUpcoming;
        if (value === 'DRAFT') return eventsCopy.bucketDraft;
        return eventsCopy.bucketCompleted;
      }),
    [dir, events, eventsCopy, query],
  );

  const errors = validateEventForm(form);
  const formOpen = createOpen || Boolean(editing);
  const formMode = editing ? 'edit' : 'create';

  /** The rail: where the reader is, and what each step behind them is worth. */
  const steps = EVENT_STEPS.map((eventStep, index) => ({
    id: eventStep.id,
    label: stepLabels[eventStep.id],
    status:
      index === step
        ? ('current' as const)
        : !visitedSteps.includes(index)
          ? ('todo' as const)
          : isEventStepValid(errors, index)
            ? ('done' as const)
            : ('invalid' as const),
  }));

  async function send(path: string, method: string, body: unknown, success: string, failureCopy: string) {
    setError('');
    setFormError('');
    setMessage('');
    const response = await apiFetch(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) return result.error ?? failureCopy;
    setMessage(success);
    await load();
    return null;
  }

  function closeForm() {
    setCreateOpen(false);
    setEditing(null);
    setForm(emptyEventForm);
    setStep(0);
    setVisitedSteps([]);
    setFormError('');
  }

  /**
   * The rail is navigation, not a gate: every step stays reachable, including
   * the ones behind an unfinished answer. Leaving a step is what makes its state
   * visible, so the rail can mark what was left undone instead of the reader
   * discovering it only at save.
   */
  function goToStep(next: number) {
    const target = clampEventStep(next);
    if (target === step) return;
    setVisitedSteps((current) => (current.includes(step) ? current : [...current, step]));
    setStep(target);
  }

  async function submitForm() {
    // Errors stay hidden until the reader leaves a step or tries to save, then
    // all of them show at once against their own fields, and the form lands on
    // the first step that needs work. The save is never disabled.
    if (!isEventFormValid(errors)) {
      setVisitedSteps(EVENT_STEPS.map((_, index) => index));
      setStep(clampEventStep(firstInvalidEventStep(errors)));
      return;
    }
    setBusy(formMode);
    const payload = eventPayload(form);
    const failure = editing
      ? await send(
          `/api/events/${editing.id}`,
          'PATCH',
          { ...payload, expectedVersion: editing.version },
          admin.messages.eventUpdated,
          admin.messages.updateFailed,
        )
      : await send('/api/events', 'POST', payload, admin.messages.draftCreated, admin.messages.actionFailed);
    setBusy(null);
    if (failure) return setFormError(failure);
    closeForm();
  }

  async function togglePublish(event: EventDto) {
    setBusy(`publish-${event.id}`);
    const failure = await send(
      `/api/events/${event.id}`,
      'PATCH',
      { isPublished: !event.isPublished, expectedVersion: event.version },
      event.isPublished ? admin.messages.unpublished : admin.messages.published,
      admin.messages.updateFailed,
    );
    setBusy(null);
    if (failure) setError(failure);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(`delete-${deleting.id}`);
    const failure = await send(`/api/events/${deleting.id}`, 'DELETE', undefined, admin.messages.eventDeleted, admin.messages.actionFailed);
    setBusy(null);
    if (failure) return setFormError(failure);
    setDeleting(null);
  }

  const needsCategories = canManageEvents && !categories.length && !loading;

  const createButton = canManageEvents ? (
    <Button
      variant="red"
      className="min-h-11 rounded-md"
      disabled={!categories.length}
      onClick={() => {
        setEditing(null);
        setForm(emptyEventForm);
        setStep(0);
        setVisitedSteps([]);
        setFormError('');
        setCreateOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      {copy.showCreate}
    </Button>
  ) : null;

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      {/* An event cannot be created without a category, so say so before the
          disabled create button becomes a puzzle. */}
      {needsCategories ? (
        <div className="mb-4">
          <Notice
            tone="warning"
            title={copy.needCategoriesTitle}
            actions={
              <Button asChild variant="red" className="min-h-11 rounded-md">
                <Link href="/admin/categories">{copy.goToCategories}</Link>
              </Button>
            }
          >
            {copy.needCategoriesDescription}
          </Notice>
        </div>
      ) : null}

      <DirectoryToolbar
        id="events"
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        searchLabel={eventsCopy.searchLabel}
        countLabel={
          visible.length === events.length
            ? fillTemplate(dir.total, { count: events.length })
            : fillTemplate(dir.shown, { shown: visible.length, total: events.length })
        }
      />

      <div className="mt-4">
        <AdminEventBoard
          events={visible}
          operations={operations}
          loading={loading}
          isOrganiser={!canManageEvents}
          title={admin.events.pipelineTitle}
          description={admin.events.pipelineDescription}
          order={sortEvents}
          headerActions={createButton ?? undefined}
          emptyAction={
            categories.length || !canManageEvents ? (
              createButton ?? undefined
            ) : (
              <Button asChild variant="red" className="min-h-11 rounded-md">
                <Link href="/admin/categories">{copy.goToCategories}</Link>
              </Button>
            )
          }
          renderActions={
            canManageEvents
              ? (event) => (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(softButtonClassName, rowActionClassName)}
                      aria-label={copy.edit}
                      title={copy.edit}
                      onClick={() => {
                        setCreateOpen(false);
                        setEditing(event);
                        setForm(formFromEvent(event));
                        setStep(0);
                        setVisitedSteps([]);
                        setFormError('');
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only 2xl:not-sr-only">{copy.edit}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={event.isPublished ? 'outline' : 'red'}
                      className={cn(event.isPublished && softButtonClassName, rowActionClassName)}
                      disabled={busy === `publish-${event.id}`}
                      aria-label={event.isPublished ? eventsCopy.unpublishAction : eventsCopy.publishAction}
                      title={event.isPublished ? eventsCopy.unpublishAction : eventsCopy.publishAction}
                      onClick={() => void togglePublish(event)}
                    >
                      {event.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only 2xl:not-sr-only">
                        {event.isPublished ? eventsCopy.unpublishAction : eventsCopy.publishAction}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(rowActionClassName, 'border-[rgba(194,65,59,0.28)] bg-white text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]')}
                      aria-label={copy.delete}
                      title={copy.delete}
                      onClick={() => {
                        setFormError('');
                        setDeleting(event);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only 2xl:not-sr-only">{copy.delete}</span>
                    </Button>
                  </>
                )
              : undefined
          }
        />
      </div>

      <StepperEditorModal
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
        title={formMode === 'edit' ? copy.editTitle : admin.events.createEvent}
        description={formMode === 'edit' ? copy.editDescription : copy.createDescription}
        formId="event-form"
        size="xl"
        busy={busy === formMode}
        steps={steps}
        current={step}
        onStepChange={goToStep}
        stepperLabel={formCopy.steps}
        progressLabel={fillTemplate(formCopy.stepOf, { current: step + 1, total: EVENT_STEPS.length })}
        stepStatusLabels={{ done: formCopy.stepDone, invalid: formCopy.stepInvalid }}
        cancelLabel={t('common.cancel')}
        backLabel={formCopy.back}
        nextLabel={formCopy.next}
        submitLabel={
          busy === formMode ? admin.messages.saving : formMode === 'edit' ? copy.saveChanges : admin.events.createDraft
        }
        onSubmit={() => void submitForm()}
      >
        <EventForm
          form={form}
          errors={errors}
          showErrors={visitedSteps.includes(step)}
          step={step}
          categories={categories}
          formId="event-form"
          submitError={formError}
          onChange={setForm}
        />
      </StepperEditorModal>

      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={deleting ? copy.deleteDescription.replace('{name}', deleting.title) : copy.deleteDescription}
        body={copy.deleteWarning}
        busy={Boolean(deleting && busy === `delete-${deleting.id}`)}
        error={formError}
        cancelLabel={t('common.cancel')}
        confirmLabel={deleting && busy === `delete-${deleting.id}` ? admin.messages.saving : copy.confirmDelete}
        onConfirm={() => void confirmDelete()}
      />
    </AdminShell>
  );
}
