'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowRightLeft, CalendarDays, CheckCircle2, Clock, LockKeyhole, MapPin, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  DashboardModal,
  MetaRow,
  RegistrationStatusBadge,
  SurfaceCard,
  formControlClassName,
  modalSoftButtonClassName,
  selectControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { cn } from '@/lib/utils';
import type { EventDto, RegistrationDto } from '@/types/dashboard';
import type { PlayerDashboardApi } from '@/hooks/usePlayerDashboard';

type EventCardProps = {
  event: EventDto;
  clubEntries: RegistrationDto[];
  canEditRegistration: boolean;
  onRegister: (event: EventDto) => void;
  onEditRegistration: (registration: RegistrationDto) => void;
};

export function EventCard({
  event,
  clubEntries,
  canEditRegistration,
  onRegister,
  onEditRegistration,
}: EventCardProps) {
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;

  const clubRegistration = clubEntries[0] ?? null;
  const registeredCategoryIds = new Set(clubEntries.map((entry) => entry.category.id));
  const registeredCategories = event.categories.filter((category) =>
    registeredCategoryIds.has(category.id),
  );
  const alreadyRegistered = Boolean(clubRegistration);
  const registrationCanBeEdited =
    canEditRegistration &&
    (event.status === 'REGISTRATION_OPEN' || event.status === 'REGISTRATION_CLOSED');
  const registrationIsOpen = event.status === 'REGISTRATION_OPEN';
  const eventIsOngoing = event.status === 'ONGOING';
  const eventIsCompleted = event.status === 'COMPLETED';
  const titleId = `event-${event.id}-title`;

  return (
    <SurfaceCard className="overflow-hidden">
      <article aria-labelledby={titleId} className="grid lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {event.categories.map((category) => {
                const registered = registeredCategoryIds.has(category.id);
                return (
                  <Badge
                    key={category.id}
                    className={cn(
                      'min-h-6 px-2.5',
                      registered
                        ? 'border-[rgba(22,128,106,0.24)] bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]'
                        : 'border-[var(--dash-border)] bg-[#faf6f3] text-[var(--dash-muted)]',
                    )}
                  >
                    {category.name}
                  </Badge>
                );
              })}
            </div>
            {alreadyRegistered ? (
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[rgba(22,128,106,0.24)] bg-[var(--dash-teal-soft)] px-2.5 text-xs font-semibold text-[var(--dash-teal)]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {player.clubEntries.teamRegistered}
              </span>
            ) : null}
          </div>

          <h3 id={titleId} className="mt-3 text-xl font-semibold leading-tight tracking-[-0.015em] text-[var(--dash-text)]">
            {event.title}
          </h3>

          {event.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dash-muted)]">{event.description}</p>
          ) : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <MetaRow icon={CalendarDays} className="min-h-11 rounded-lg border border-[var(--dash-border)] bg-[#faf6f3] px-3 py-2.5">
              {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
            </MetaRow>
            <MetaRow icon={MapPin} className="min-h-11 rounded-lg border border-[var(--dash-border)] bg-[#faf6f3] px-3 py-2.5">
              {event.location}
            </MetaRow>
            {event.arrivalTime ? (
              <MetaRow icon={Clock} className="min-h-11 rounded-lg border border-[var(--dash-border)] bg-[#faf6f3] px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                {player.arrivalLabel}:{' '}
                {formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' })}
              </MetaRow>
            ) : null}
          </div>

          <p className={cn('mt-4 text-sm', alreadyRegistered ? 'font-medium text-[var(--dash-teal)]' : 'text-[var(--dash-muted)]')}>
            {alreadyRegistered
              ? t('dashboard.player.registeredIn', {
                  categories: registeredCategories.map((category) => category.name).join(', '),
                })
              : t('dashboard.player.oneCategoryHint', { count: event.categories.length })}
          </p>

          {clubEntries.length ? (
            <div className="mt-5 border-t border-[var(--dash-border)] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-muted)]">
                {player.clubEntries.eventTeams}
              </p>
              <div className="mt-2 grid gap-2">
                {clubEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex min-h-11 flex-col gap-2 rounded-lg border border-[var(--dash-border)] bg-[#faf6f3] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--dash-text)]">
                        {entry.owner.fullName} / {entry.teammate.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--dash-muted)]">{entry.category.name}</p>
                    </div>
                    <RegistrationStatusBadge status={entry.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-5 border-t border-[var(--dash-border)] bg-[#faf6f3] p-5 sm:flex-row sm:items-center lg:flex-col lg:items-stretch lg:border-l lg:border-t-0 lg:p-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--dash-muted)]">
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                {player.registerModal.feeLabel}
              </p>
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--dash-text)]">
              {t('dashboard.player.registerModal.feeAmount', { amount: event.participationFee })}
            </p>
          </div>

          {clubRegistration && registrationCanBeEdited ? (
            <Button
              type="button"
              variant="red"
              className="min-h-11 w-full rounded-lg px-4 sm:w-auto lg:w-full"
              onClick={() => onEditRegistration(clubRegistration)}
            >
              {player.clubEntries.editRegistration}
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : eventIsCompleted ? (
            <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 w-full rounded-lg px-4 sm:w-auto lg:w-full')}>
              <Link href={`/dashboard/events/${event.id}`}>
                {player.clubEntries.viewResults}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : eventIsOngoing ? (
            <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 w-full rounded-lg px-4 sm:w-auto lg:w-full')}>
              <Link href={`/dashboard/events/${event.id}`}>
                {player.clubEntries.viewEvent}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : clubRegistration ? (
            <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 w-full rounded-lg px-4 sm:w-auto lg:w-full')}>
              <Link href="/dashboard/entries">
                {player.clubEntries.viewRegistration}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : !registrationIsOpen ? (
            <Button
              type="button"
              variant="outline"
              className={cn(softButtonClassName, 'min-h-11 w-full rounded-lg px-4 sm:w-auto lg:w-full')}
              disabled
            >
              {player.clubEntries.registrationClosed}
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="red" className="min-h-11 w-full rounded-lg px-5 sm:w-auto lg:w-full" onClick={() => onRegister(event)}>
              {player.buttons.openRegister}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </article>
    </SurfaceCard>
  );
}

type RegisterModalProps = {
  api: PlayerDashboardApi;
  onRegistered?: () => void;
};

export function RegisterModal({ api, onRegistered }: RegisterModalProps) {
  const { dictionary, t, locale } = useI18n();
  const [legalAccepted, setLegalAccepted] = useState(false);
  const player = dictionary.dashboard.player;
  const {
    registerEvent,
    registerEventBank,
    setRegisterEvent,
    user,
    eventForm,
    updateEventForm,
    selectSavedTeammate,
    savedTeammates,
    submitRegistration,
    savingEventId,
    error,
  } = api;

  const activeForm = registerEvent ? eventForm(registerEvent) : null;
  const alreadyRegisteredForEvent = registerEvent
    ? api.registeredEventIds.has(registerEvent.id)
    : false;
  const selectedClubMember = activeForm?.savedTeammateId
    ? savedTeammates.find((teammate) => teammate.id === activeForm.savedTeammateId)
    : null;
  const ownerPhoneLocked = Boolean(user.phone);
  const canSubmit =
    Boolean(registerEvent) &&
    Boolean(activeForm?.categoryId) &&
    Boolean(activeForm?.ownerPhone.trim()) &&
    Boolean(activeForm?.teammateEmail.trim()) &&
    Boolean(activeForm?.savedTeammateId) &&
    legalAccepted &&
    !alreadyRegisteredForEvent &&
    savingEventId !== registerEvent?.id;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const registered = await submitRegistration(event, onRegistered);
    if (registered) setLegalAccepted(false);
  }

  return (
    <DashboardModal
      open={Boolean(registerEvent)}
      onOpenChange={(open) => {
        if (!open) {
          setLegalAccepted(false);
          setRegisterEvent(null);
        }
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
            <div className="rounded-md border border-red-400/25 bg-red-950/45 px-3 py-2 text-sm text-red-100">{error}</div>
          ) : null}
          {alreadyRegisteredForEvent ? (
            <div className="rounded-md border border-emerald-400/25 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100">
              {player.messages.oneCategoryOnly}
            </div>
          ) : null}

          <div className="rounded-md border border-[#e7dcd8] bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6d5f5c]">
              {player.registerModal.feeLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-[#2a1f1e]">
              {t('dashboard.player.registerModal.feeAmount', { amount: registerEvent.participationFee })}
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6d5f5c]">
              {player.registerModal.bankReceiverLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#2a1f1e]">
              {registerEventBank?.bankAccountReceiver ?? '…'}
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6d5f5c]">
              {player.registerModal.bankAccountLabel}
            </p>
            <p className="mt-1 break-all font-mono text-sm font-semibold tracking-wide text-[#2a1f1e]">
              {registerEventBank?.bankAccountIban ?? '…'}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#7a6c69]">{player.registerModal.feeNote}</p>
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
              readOnly={ownerPhoneLocked}
            />
          </DashboardField>

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
              <option value="">{player.registerModal.chooseSavedTeammate}</option>
              {savedTeammates.map((teammate) => (
                <option key={teammate.id} value={teammate.id}>
                  {teammate.fullName} · {teammate.email}
                </option>
              ))}
            </select>
          </DashboardField>

          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardField label={player.fields.teammateEmail} id={`teammate-${registerEvent.id}`}>
              <Input
                id={`teammate-${registerEvent.id}`}
                type="email"
                required
                value={activeForm.teammateEmail}
                placeholder={selectedClubMember ? selectedClubMember.email : 'teammate@example.com'}
                className={formControlClassName}
                readOnly
              />
            </DashboardField>
            <DashboardField
              label={player.fields.teammatePhone}
              id={`teammate-phone-${registerEvent.id}`}
            >
              <Input
                id={`teammate-phone-${registerEvent.id}`}
                type="tel"
                value={activeForm.teammatePhone}
                placeholder="+995 555 000 000"
                className={formControlClassName}
                readOnly
              />
            </DashboardField>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e7dcd8] bg-white p-4 text-sm leading-6 text-[#4a3d3b]">
            <input name="participationLegalAccepted" className="mt-1 h-5 w-5 shrink-0 accent-[var(--padel-red)]" type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required />
            <span>{locale === 'ka' ? 'ვეთანხმები ' : 'I accept the '}<Link href="/legal/terms" target="_blank" className="font-semibold underline underline-offset-4">{locale === 'ka' ? 'ტურნირში მონაწილეობის პირობებს' : 'Tournament Participation Terms'}</Link>{locale === 'ka' ? ', გავეცანი ' : ', acknowledge the '}<Link href="/legal/refunds" target="_blank" className="font-semibold underline underline-offset-4">{locale === 'ka' ? 'თანხის დაბრუნებისა და გაუქმების პოლიტიკას' : 'Refund and Cancellation Policy'}</Link>{locale === 'ka' ? ' და ვადასტურებ გადახდის ვალდებულებასა და სპორტში მონაწილეობის ჩვეულებრივ ფიზიკურ რისკებს.' : ', and confirm the payment obligation and ordinary physical risks of participation.'}</span>
          </label>
        </form>
      ) : null}
    </DashboardModal>
  );
}
