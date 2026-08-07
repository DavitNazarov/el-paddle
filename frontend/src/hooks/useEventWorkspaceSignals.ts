'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { RegistrationDto } from '@/types/admin';
import type { BracketDto, CourtDto, OpponentRequestDto } from '@/types/tournament';
import { buildControlSummary } from '@/components/admin/control/controlModel';

/**
 * Live counts the event workspace prints on each stage card. A null section
 * means the reader could not see that stage — organisers and admins have
 * different capabilities, so a refused read is a missing number, not an error.
 */
export type EventWorkspaceSignals = {
  registrations: { approved: number; pending: number } | null;
  requests: { awaiting: number; total: number } | null;
  brackets: { locked: number; published: number; total: number } | null;
  schedule: { courts: number; queued: number } | null;
  /** Derived from the same bracket read, so match control costs no extra request. */
  control: { live: number; ready: number } | null;
};

const emptySignals: EventWorkspaceSignals = {
  registrations: null,
  requests: null,
  brackets: null,
  schedule: null,
  control: null,
};

/** Opponent-request states that still sit in the administrator's decision queue. */
const awaitingDecision = new Set(['ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'CONFLICTED']);

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await apiFetch(path, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function useEventWorkspaceSignals(eventId: string) {
  const [signals, setSignals] = useState<EventWorkspaceSignals>(emptySignals);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [registrations, requests, brackets, schedule] = await Promise.all([
        readJson<{ registrations: RegistrationDto[] }>(`/api/admin/events/${eventId}/registrations`),
        readJson<{ requests: OpponentRequestDto[] }>(`/api/admin/events/${eventId}/opponent-requests`),
        readJson<{ brackets: BracketDto[] }>(`/api/admin/events/${eventId}/brackets`),
        readJson<{ courts: CourtDto[] }>(`/api/admin/events/${eventId}/schedule`),
      ]);
      if (cancelled) return;

      setSignals({
        registrations: registrations
          ? {
              approved: registrations.registrations.filter((item) => item.status === 'APPROVED').length,
              pending: registrations.registrations.filter((item) => item.status === 'PENDING').length,
            }
          : null,
        requests: requests
          ? {
              awaiting: requests.requests.filter((item) => awaitingDecision.has(item.status)).length,
              total: requests.requests.length,
            }
          : null,
        brackets: brackets
          ? {
              locked: brackets.brackets.filter((item) => item.status !== 'DRAFT').length,
              published: brackets.brackets.filter((item) => item.publishedAt).length,
              total: brackets.brackets.length,
            }
          : null,
        schedule: schedule
          ? {
              courts: schedule.courts.length,
              queued: schedule.courts.reduce((total, court) => total + court.scheduleItems.length, 0),
            }
          : null,
        control: brackets
          ? (({ live, ready }) => ({ live, ready }))(buildControlSummary(brackets.brackets))
          : null,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { signals, loading };
}
