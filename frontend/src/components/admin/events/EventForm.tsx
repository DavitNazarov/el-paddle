'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChoiceGrid,
  Field,
  FieldPair,
  FormSection,
  dashboardFormClassName,
} from '@/components/shared/dashboard/DashboardForm';
import { Notice } from '@/components/shared/dashboard/Feedback';
import { formControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { CategoryDto } from '@/types/admin';
import { toggleCategoryId, type EventFieldErrors, type EventFormState } from './eventsModel';

/**
 * The event form, and the first screen of the *form* archetype: fields grouped
 * by the question they answer, every failure shown against the field that
 * caused it, and a save that is always available. The old version disabled save
 * until the whole form validated, which left a reader with a dead button and no
 * idea which of eight fields was wrong.
 */
export function EventForm({
  form,
  errors,
  showErrors,
  categories,
  formId,
  submitError,
  onChange,
}: {
  form: EventFormState;
  errors: EventFieldErrors;
  /** Errors stay hidden until the first save attempt, so a fresh form is not a wall of red. */
  showErrors: boolean;
  categories: CategoryDto[];
  formId: string;
  submitError?: string;
  onChange: (form: EventFormState) => void;
}) {
  const { dictionary, locale, t } = useI18n();
  const events = dictionary.dashboard.admin.events;
  const copy = tournamentCopy[locale].admin.events;
  const formCopy = tournamentCopy[locale].admin.form;

  const errorFor = (field: keyof EventFormState) => {
    if (!showErrors) return undefined;
    const code = errors[field];
    return code ? formCopy.errors[code] : undefined;
  };

  const set = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) =>
    onChange({ ...form, [field]: value });

  return (
    <div className={dashboardFormClassName}>
      {submitError ? <Notice tone="error">{submitError}</Notice> : null}
      {showErrors && Object.keys(errors).length ? <Notice tone="warning">{formCopy.fixErrors}</Notice> : null}

      <FormSection title={copy.sectionIdentity} detail={copy.sectionIdentityDetail}>
        <Field id={`${formId}-title`} label={events.eventTitle} error={errorFor('title')}>
          {(control) => (
            <Input
              {...control}
              value={form.title}
              placeholder={events.eventPlaceholder}
              className={formControlClassName}
              onChange={(field) => set('title', field.target.value)}
            />
          )}
        </Field>
        <Field id={`${formId}-description`} label={events.descriptionLabel} hint={t('common.optional')}>
          {(control) => (
            <Textarea
              {...control}
              value={form.description}
              placeholder={events.eventDescriptionPlaceholder}
              className={formControlClassName}
              onChange={(field) => set('description', field.target.value)}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title={copy.sectionWhen} detail={copy.sectionWhenDetail}>
        <FieldPair>
          <Field id={`${formId}-date`} label={events.date} error={errorFor('date')}>
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={form.date}
                className={formControlClassName}
                onChange={(field) => set('date', field.target.value)}
              />
            )}
          </Field>
          <Field id={`${formId}-arrival`} label={events.arrivalTime} hint={events.arrivalTimeHint}>
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={form.arrivalTime}
                className={formControlClassName}
                onChange={(field) => set('arrivalTime', field.target.value)}
              />
            )}
          </Field>
        </FieldPair>
        <Field id={`${formId}-location`} label={events.location} error={errorFor('location')}>
          {(control) => (
            <Input
              {...control}
              value={form.location}
              placeholder={events.locationPlaceholder}
              className={formControlClassName}
              onChange={(field) => set('location', field.target.value)}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title={copy.sectionMoney} detail={copy.sectionMoneyDetail}>
        <FieldPair>
          <Field
            id={`${formId}-fee`}
            label={events.participationFee}
            hint={events.participationFeeHint}
            error={errorFor('participationFee')}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.participationFee}
                placeholder={events.participationFeePlaceholder}
                className={formControlClassName}
                onChange={(field) => set('participationFee', field.target.value)}
              />
            )}
          </Field>
          <Field
            id={`${formId}-receiver`}
            label={events.bankAccountReceiver}
            hint={events.bankAccountReceiverHint}
            error={errorFor('bankAccountReceiver')}
          >
            {(control) => (
              <Input
                {...control}
                value={form.bankAccountReceiver}
                placeholder={events.bankAccountReceiverPlaceholder}
                className={formControlClassName}
                onChange={(field) => set('bankAccountReceiver', field.target.value)}
              />
            )}
          </Field>
        </FieldPair>
        <Field
          id={`${formId}-iban`}
          label={events.bankAccountIban}
          hint={events.bankAccountIbanHint}
          error={errorFor('bankAccountIban')}
        >
          {(control) => (
            <Input
              {...control}
              value={form.bankAccountIban}
              placeholder={events.bankAccountIbanPlaceholder}
              className={cn(formControlClassName, 'font-mono uppercase tracking-wide')}
              autoComplete="off"
              spellCheck={false}
              onChange={(field) => set('bankAccountIban', field.target.value)}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title={copy.sectionCategories} detail={copy.sectionCategoriesDetail}>
        <Field id={`${formId}-categories`} label={events.categories} error={errorFor('categoryIds')}>
          {() => (
            <ChoiceGrid
              items={categories}
              name={`${formId}-categories`}
              itemKey={(category) => category.id}
              itemLabel={(category) => category.name}
              selected={(category) => form.categoryIds.includes(category.id)}
              onToggle={(category) => set('categoryIds', toggleCategoryId(form.categoryIds, category.id))}
            />
          )}
        </Field>
      </FormSection>
    </div>
  );
}
