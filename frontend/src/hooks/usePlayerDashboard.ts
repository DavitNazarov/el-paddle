'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import type {
  DashboardData,
  EventDto,
  RegistrationDto,
  RegistrationFormState,
  StatusFilter,
} from '@/types/dashboard';
import type { PublicUser } from '@/types/auth';

export type SavedTeammate = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
};

function emptyForm(event: EventDto, current?: RegistrationFormState): RegistrationFormState {
  return {
    categoryId: current?.categoryId || event.categories[0]?.id || '',
    ownerPhone: current?.ownerPhone ?? '',
    teammateEmail: current?.teammateEmail ?? '',
    teammatePhone: current?.teammatePhone ?? '',
    savedTeammateId: current?.savedTeammateId ?? '',
  };
}

export function usePlayerDashboard(
  initialUser: PublicUser,
  initialData: DashboardData | null = null,
) {
  const router = useRouter();
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(initialData);
  const [forms, setForms] = useState<Record<string, RegistrationFormState>>({});
  const [registerEvent, setRegisterEvent] = useState<EventDto | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [savingEventId, setSavingEventId] = useState('');
  // Bank details are omitted from the dashboard list payload (F3); fetch them
  // from the single-event endpoint only when the register modal opens.
  const [bankByEvent, setBankByEvent] = useState<
    Record<string, { bankAccountReceiver: string; bankAccountIban: string }>
  >({});
  const [bankStatus, setBankStatus] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});

  const user = data?.user ?? initialUser;
  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const registrations = useMemo(() => data?.registrations ?? [], [data?.registrations]);
  const clubMembers = useMemo(() => data?.clubMembers ?? [], [data?.clubMembers]);
  const clubMembershipRole = data?.clubMembershipRole ?? null;
  const personalRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          registration.owner.id === user.id || registration.teammate.id === user.id,
      ),
    [registrations, user.id],
  );

  const registrationCounts = useMemo(
    () => ({
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
      waitlisted: registrations.filter((item) => item.status === 'WAITLISTED').length,
      /** Entries waiting on the player, not on an organiser. */
      attention: registrations.filter((item) => item.status === 'NEEDS_CHANGES').length,
      all: registrations.length,
    }),
    [registrations],
  );

  const registrationKeys = useMemo(
    () => new Set(registrations.map((item) => `${item.event.id}:${item.category.id}`)),
    [registrations],
  );

  /**
   * A club can submit one team per event. Any existing row — including a
   * declined one — still occupies the unique club+event slot, so the UI must
   * not offer a second registration.
   */
  const registeredEventIds = useMemo(
    () => new Set(registrations.map((item) => item.event.id)),
    [registrations],
  );

  // Club mates who have not accepted their invitation stay in the list but cannot
  // be picked: registration refuses them, so hiding them would leave the captain
  // hunting for a mate who looks absent from their own club.
  const savedTeammates = useMemo(
    () =>
      clubMembers.map((member) => ({
        id: member.id,
        email: member.email,
        fullName: member.fullName || member.email,
        phone: member.phone,
        selectable: member.status === 'ACTIVE',
      })),
    [clubMembers],
  );

  // "Next up" must be something still ahead, so a finished event is never it.
  // Completion is the server's call: the clock cannot be read here without
  // making the render impure, and every other status is still in play.
  const nextEvent = useMemo(
    () => events.find((event) => event.status !== 'COMPLETED') ?? null,
    [events],
  );
  const nextMatch = data?.nextMatch ?? null;
  const receivedRequests = useMemo(() => data?.receivedRequests ?? [], [data?.receivedRequests]);
  const sentRequests = useMemo(() => data?.sentRequests ?? [], [data?.sentRequests]);
  const requestWindows = useMemo(() => data?.requestWindows ?? [], [data?.requestWindows]);
  const registerEventBank = registerEvent ? bankByEvent[registerEvent.id] ?? null : null;
  const registerEventBankStatus = registerEvent
    ? (bankStatus[registerEvent.id] ?? (registerEventBank ? 'ready' : 'idle'))
    : 'idle';
  const winRate =
    user.stats.matchesPlayed > 0
      ? Math.round((user.stats.wins / user.stats.matchesPlayed) * 100)
      : null;

  // A failed load must say so: a silent catch here used to leave the page
  // blank, which reads as "you have nothing" rather than "we could not check".
  const [loadFailed, setLoadFailed] = useState(false);

  const loadDashboard = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setLoadFailed(false);
      try {
        const response = await apiFetch('/api/dashboard', { cache: 'no-store' });
        if (response.status === 401) {
          router.push('/login?next=/dashboard');
          return;
        }
        if (!response.ok) throw new Error(`dashboard load failed: ${response.status}`);
        const nextData = (await response.json()) as DashboardData;
        setData(nextData);
      } catch {
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    // Pages that hydrate from the server render (F6) already have the payload;
    // skip the mount refetch and let loadDashboard() handle post-mutation refreshes.
    if (initialData) return;
    const timer = window.setTimeout(() => {
      void loadDashboard(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard, initialData]);

  function eventForm(event: EventDto): RegistrationFormState {
    return emptyForm(event, forms[event.id]);
  }

  function updateEventForm(eventId: string, field: keyof RegistrationFormState, value: string) {
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? user.phone,
        teammateEmail: current[eventId]?.teammateEmail ?? '',
        teammatePhone: current[eventId]?.teammatePhone ?? '',
        savedTeammateId: current[eventId]?.savedTeammateId ?? '',
        [field]: value,
      },
    }));
  }

  function selectSavedTeammate(eventId: string, teammateId: string) {
    const found = teammateId ? savedTeammates.find((item) => item.id === teammateId) : null;
    const teammate = found?.selectable ? found : null;
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? user.phone,
        savedTeammateId: teammate?.id ?? '',
        teammateEmail: teammate?.email ?? '',
        teammatePhone: teammate?.phone ?? '',
      },
    }));
  }

  function setTeammateEmail(eventId: string, email: string) {
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? user.phone,
        teammatePhone: current[eventId]?.teammatePhone ?? '',
        savedTeammateId: '',
        teammateEmail: email,
      },
    }));
  }

  function loadEventBankDetails(eventId: string) {
    if (bankStatus[eventId] === 'loading') return;
    if (bankByEvent[eventId] && bankStatus[eventId] === 'ready') return;
    setBankStatus((current) => ({ ...current, [eventId]: 'loading' }));
    void apiFetch(`/api/events/${eventId}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`bank ${response.status}`);
        return response.json() as Promise<{
          event?: { bankAccountReceiver?: string; bankAccountIban?: string };
        }>;
      })
      .then((payload) => {
        const bank = payload.event;
        if (!bank?.bankAccountIban) {
          setBankStatus((current) => ({ ...current, [eventId]: 'error' }));
          return;
        }
        setBankByEvent((current) => ({
          ...current,
          [eventId]: {
            bankAccountReceiver: bank.bankAccountReceiver ?? '',
            bankAccountIban: bank.bankAccountIban ?? '',
          },
        }));
        setBankStatus((current) => ({ ...current, [eventId]: 'ready' }));
      })
      .catch(() => {
        setBankStatus((current) => ({ ...current, [eventId]: 'error' }));
      });
  }

  function openRegister(event: EventDto) {
    if (registeredEventIds.has(event.id)) return;
    setError('');
    setForms((current) => ({
      ...current,
      [event.id]: {
        ...emptyForm(event, current[event.id]),
        ownerPhone: current[event.id]?.ownerPhone ?? user.phone,
      },
    }));
    setRegisterEvent(event);
    loadEventBankDetails(event.id);
  }

  async function submitRegistration(formEvent: FormEvent<HTMLFormElement>, onSuccess?: () => void) {
    formEvent.preventDefault();
    if (!registerEvent) return;
    const submitted = new FormData(formEvent.currentTarget);
    const legalAccepted = submitted.get('participationLegalAccepted') === 'on';
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
        participationTermsAccepted: legalAccepted,
        refundPolicyAcknowledged: legalAccepted,
        riskAcknowledged: legalAccepted,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSavingEventId('');

    if (!response.ok) {
      setError(result.error ?? t('dashboard.player.messages.registerError'));
      return false;
    }

    setMessage(t('dashboard.player.messages.registerSuccess'));
    setForms((current) => ({
      ...current,
      [registerEvent.id]: emptyForm(registerEvent),
    }));
    setRegisterEvent(null);
    await loadDashboard();
    onSuccess?.();
    return true;
  }

  function filterRegistrations(filter: StatusFilter): RegistrationDto[] {
    if (filter === 'ALL') return registrations;
    return registrations.filter((item) => item.status === filter);
  }

  return {
    user,
    events,
    registrations,
    personalRegistrations,
    registrationCounts,
    registrationKeys,
    registeredEventIds,
    savedTeammates,
    clubMembers,
    clubMembershipRole,
    nextEvent,
    nextMatch,
    receivedRequests,
    sentRequests,
    requestWindows,
    winRate,
    loading,
    loadFailed,
    message,
    error,
    setMessage,
    setError,
    registerEvent,
    registerEventBank,
    registerEventBankStatus,
    reloadEventBank: loadEventBankDetails,
    setRegisterEvent,
    savingEventId,
    eventForm,
    updateEventForm,
    selectSavedTeammate,
    setTeammateEmail,
    openRegister,
    submitRegistration,
    filterRegistrations,
    loadDashboard,
  };
}

export type PlayerDashboardApi = ReturnType<typeof usePlayerDashboard>;
