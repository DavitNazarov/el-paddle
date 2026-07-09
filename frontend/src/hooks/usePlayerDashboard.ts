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

export function usePlayerDashboard(initialUser: PublicUser) {
  const router = useRouter();
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [forms, setForms] = useState<Record<string, RegistrationFormState>>({});
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
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
      all: registrations.length,
    }),
    [registrations],
  );

  const registrationKeys = useMemo(
    () => new Set(registrations.map((item) => `${item.event.id}:${item.category.id}`)),
    [registrations],
  );

  /** One entry per event — any category counts as already registered. */
  const registeredEventIds = useMemo(
    () => new Set(registrations.map((item) => item.event.id)),
    [registrations],
  );

  /** Distinct past teammates from entries where the current user was the owner. */
  const savedTeammates = useMemo(() => {
    const byId = new Map<string, SavedTeammate>();
    for (const entry of registrations) {
      if (entry.owner.id !== user.id) continue;
      if (entry.teammate.id === user.id) continue;
      if (byId.has(entry.teammate.id)) continue;
      byId.set(entry.teammate.id, {
        id: entry.teammate.id,
        email: entry.teammate.email,
        fullName: entry.teammate.fullName || entry.teammate.email,
        phone: entry.teammatePhone || '',
      });
    }
    return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [registrations, user.id]);

  const nextEvent = events[0] ?? null;
  const winRate =
    user.stats.matchesPlayed > 0
      ? Math.round((user.stats.wins / user.stats.matchesPlayed) * 100)
      : null;

  const loadDashboard = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      const response = await apiFetch('/api/dashboard', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login?next=/dashboard');
        return;
      }
      const nextData = (await response.json()) as DashboardData;
      setData(nextData);
      setLoading(false);
    },
    [router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  function eventForm(event: EventDto): RegistrationFormState {
    return emptyForm(event, forms[event.id]);
  }

  function updateEventForm(eventId: string, field: keyof RegistrationFormState, value: string) {
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? '',
        teammateEmail: current[eventId]?.teammateEmail ?? '',
        teammatePhone: current[eventId]?.teammatePhone ?? '',
        savedTeammateId: current[eventId]?.savedTeammateId ?? '',
        [field]: value,
      },
    }));
  }

  function selectSavedTeammate(eventId: string, teammateId: string) {
    const teammate = teammateId ? savedTeammates.find((item) => item.id === teammateId) : null;
    setForms((current) => ({
      ...current,
      [eventId]: {
        categoryId: current[eventId]?.categoryId ?? '',
        ownerPhone: current[eventId]?.ownerPhone ?? '',
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
        ownerPhone: current[eventId]?.ownerPhone ?? '',
        teammatePhone: current[eventId]?.teammatePhone ?? '',
        savedTeammateId: '',
        teammateEmail: email,
      },
    }));
  }

  function openRegister(event: EventDto) {
    if (registeredEventIds.has(event.id)) return;
    setError('');
    setForms((current) => ({
      ...current,
      [event.id]: emptyForm(event, current[event.id]),
    }));
    setRegisterEvent(event);
  }

  async function submitRegistration(formEvent: FormEvent<HTMLFormElement>, onSuccess?: () => void) {
    formEvent.preventDefault();
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
    registrationCounts,
    registrationKeys,
    registeredEventIds,
    savedTeammates,
    nextEvent,
    winRate,
    loading,
    message,
    error,
    setMessage,
    setError,
    registerEvent,
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
