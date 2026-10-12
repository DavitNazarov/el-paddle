'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { RegistrationDto } from '@/types/admin';
import type { BracketDto, CourtDto, OpponentRequestDto } from '@/types/tournament';
import { bandOf, buildControlMatches } from '@/components/admin/control/runBoard';
import { courtState, unscheduledMatches } from '@/components/admin/schedule/scheduleModel';

/**
 * Live counts the event workspace prints on each stage card. A null section
 * means the reader could not see that stage — organisers and admins have
 * different capabilities, so a refused read is a missing number, not an error.
 */
export type EventWorkspaceSignals = {
  registrations: { approved: number; pending: number } | null;
  requests: { awaiting: number; total: number } | null;
  brackets: { locked: number; published: number; total: number } | null;
  schedule: {
    courts: number;
    queued: number;
    /** Courts standing free with matches still queued on them — dead time. */
    courtsIdle: number;
    /** Matches in a draw that are in no court queue at all. */
    unscheduled: number;
  } | null;
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

/**
 * The two numbers the match-control card prints. Courts are not read here, so
 * this counts matches by state rather than building the console's whole board.
 */
function controlSignal(brackets: BracketDto[]) {
  const bands = buildControlMatches(brackets, Date.now()).map((entry) => bandOf(entry.match));
  return {
    live: bands.filter((band) => band === 'live').length,
    ready: bands.filter((band) => band === 'ready').length,
  };
}

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
              // `ready` is a court with work queued and nothing on it: free, and
              // costing the event time for as long as it stays that way.
              courtsIdle: schedule.courts.filter((court) => courtState(court) === 'ready').length,
              unscheduled: brackets
                ? unscheduledMatches(
                    brackets.brackets.flatMap((bracket) => bracket.matches),
                    schedule.courts,
                  ).length
                : 0,
            }
          : null,
        control: brackets ? controlSignal(brackets.brackets) : null,
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
