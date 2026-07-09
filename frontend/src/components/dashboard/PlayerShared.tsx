'use client';

import type { FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  DashboardModal,
  MetaRow,
  SurfaceCard,
  formControlClassName,
  modalSoftButtonClassName,
  selectControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { cn } from '@/lib/utils';
import type { EventDto } from '@/types/dashboard';
import type { PlayerDashboardApi } from '@/hooks/usePlayerDashboard';

type EventCardProps = {
  event: EventDto;
  registrationKeys: Set<string>;
  registeredEventIds: Set<string>;
  onRegister: (event: EventDto) => void;
};

export function EventCard({ event, registrationKeys, registeredEventIds, onRegister }: EventCardProps) {
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;

  const registeredCategories = event.categories.filter((category) =>
    registrationKeys.has(`${event.id}:${category.id}`),
  );
  const alreadyRegistered = registeredEventIds.has(event.id);

  return (
    <SurfaceCard>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {event.categories.map((category) => {
              const registered = registrationKeys.has(`${event.id}:${category.id}`);
              return (
                <Badge
                  key={category.id}
                  className={cn(
                    registered
                      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-[rgba(246,239,225,0.14)] bg-transparent text-[rgba(246,239,225,0.65)]',
                  )}
                >
                  {category.name}
                </Badge>
              );
            })}
          </div>
          <h3 className="mt-2.5 text-lg font-semibold text-[var(--padel-ivory)]">{event.title}</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <MetaRow icon={CalendarDays}>
              {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
            </MetaRow>
            <MetaRow icon={MapPin}>{event.location}</MetaRow>
            {event.arrivalTime ? (
              <MetaRow icon={Clock}>
                {player.arrivalLabel}:{' '}
                {formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' })}
              </MetaRow>
            ) : null}
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--padel-gold)]">
            {player.registerModal.feeLabel}:{' '}
            {t('dashboard.player.registerModal.feeAmount', { amount: event.participationFee })}
          </p>
          {event.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-5 text-[rgba(246,239,225,0.5)]">{event.description}</p>
          ) : null}
          {alreadyRegistered ? (
            <p className="mt-3 text-sm text-emerald-300/90">
              {t('dashboard.player.registeredIn', {
                categories: registeredCategories.map((category) => category.name).join(', '),
              })}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[rgba(246,239,225,0.42)]">
              {t('dashboard.player.oneCategoryHint', { count: event.categories.length })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {alreadyRegistered ? (
            <Button variant="outline" className={cn(softButtonClassName, 'w-full rounded-md sm:w-auto')} disabled>
              <CheckCircle2 className="h-4 w-4" />
              {player.buttons.alreadyRegistered}
            </Button>
          ) : (
            <Button variant="red" className="w-full rounded-md sm:w-auto" onClick={() => onRegister(event)}>
              {player.buttons.openRegister}
            </Button>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

type RegisterModalProps = {
  api: PlayerDashboardApi;
  onRegistered?: () => void;
};

export function RegisterModal({ api, onRegistered }: RegisterModalProps) {
  const { dictionary, t } = useI18n();
  const player = dictionary.dashboard.player;
  const {
    registerEvent,
    setRegisterEvent,
    eventForm,
    updateEventForm,
    selectSavedTeammate,
    setTeammateEmail,
    savedTeammates,
    submitRegistration,
    savingEventId,
    error,
  } = api;

  const activeForm = registerEvent ? eventForm(registerEvent) : null;
  const alreadyRegisteredForEvent = registerEvent
    ? api.registeredEventIds.has(registerEvent.id)
    : false;
  const usingSavedTeammate = Boolean(activeForm?.savedTeammateId);
  const canSubmit =
    Boolean(registerEvent) &&
    Boolean(activeForm?.categoryId) &&
    Boolean(activeForm?.ownerPhone.trim()) &&
    Boolean(activeForm?.teammateEmail.trim()) &&
    !alreadyRegisteredForEvent &&
    savingEventId !== registerEvent?.id;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    await submitRegistration(event, onRegistered);
  }

  return (
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
          <Button type="button" variant="outline" className={modalSoftButtonClassName} onClick={() => setRegisterEvent(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="player-register-form" variant="red" disabled={!canSubmit}>
            {alreadyRegisteredForEvent
              ? player.buttons.alreadyRegistered
              : savingEventId === registerEvent?.id
                ? player.buttons.sending
                : player.buttons.registerTeam}
          </Button>
        </>
      }
    >
      {registerEvent && activeForm ? (
        <form id="player-register-form" onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
          ) : null}
          {alreadyRegisteredForEvent ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {player.messages.oneCategoryOnly}
            </div>
          ) : null}

          <div className="rounded-md border border-[rgba(19,2,2,0.1)] bg-[#f7efe3] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(19,2,2,0.5)]">
              {player.registerModal.feeLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--padel-ink)]">
              {t('dashboard.player.registerModal.feeAmount', { amount: registerEvent.participationFee })}
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(19,2,2,0.5)]">
              {player.registerModal.bankReceiverLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--padel-ink)]">
              {registerEvent.bankAccountReceiver}
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(19,2,2,0.5)]">
              {player.registerModal.bankAccountLabel}
            </p>
            <p className="mt-1 break-all font-mono text-sm font-semibold tracking-wide text-[var(--padel-ink)]">
              {registerEvent.bankAccountIban}
            </p>
            <p className="mt-2 text-xs leading-5 text-[rgba(19,2,2,0.55)]">{player.registerModal.feeNote}</p>
          </div>

          <DashboardField label={player.fields.category} id={`category-${registerEvent.id}`}>
            <select
              id={`category-${registerEvent.id}`}
              value={activeForm.categoryId}
              onChange={(item) => updateEventForm(registerEvent.id, 'categoryId', item.target.value)}
              className={selectControlClassName}
              disabled={alreadyRegisteredForEvent}
            >
              {registerEvent.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </DashboardField>

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

          {savedTeammates.length ? (
            <DashboardField
              label={player.fields.savedTeammate}
              id={`saved-teammate-${registerEvent.id}`}
              hint={player.registerModal.savedTeammatesHint}
            >
              <select
                id={`saved-teammate-${registerEvent.id}`}
                value={activeForm.savedTeammateId}
                onChange={(item) => selectSavedTeammate(registerEvent.id, item.target.value)}
                className={selectControlClassName}
                disabled={alreadyRegisteredForEvent}
              >
                <option value="">{player.registerModal.addNewTeammate}</option>
                {savedTeammates.map((teammate) => (
                  <option key={teammate.id} value={teammate.id}>
                    {teammate.fullName} · {teammate.email}
                  </option>
                ))}
              </select>
            </DashboardField>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardField label={player.fields.teammateEmail} id={`teammate-${registerEvent.id}`}>
              <Input
                id={`teammate-${registerEvent.id}`}
                type="email"
                required
                value={activeForm.teammateEmail}
                onChange={(item) => setTeammateEmail(registerEvent.id, item.target.value)}
                placeholder="teammate@example.com"
                className={formControlClassName}
                readOnly={usingSavedTeammate}
              />
            </DashboardField>
            <DashboardField
              label={player.fields.teammatePhone}
              id={`teammate-phone-${registerEvent.id}`}
              hint={t('common.optional')}
            >
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
        </form>
      ) : null}
    </DashboardModal>
  );
}
