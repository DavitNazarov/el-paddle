'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BracketDto, CourtDto, MatchDto } from '@/types/tournament';
import type { EventDto } from '@/types/admin';
import { apiFetch, createCommandId } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { buildRunBoard, reorderedQueue, type CourtLane } from './runBoard';
import type { Side } from './matchModel';

/**
 * Everything the match-day screens need from the server, and every command they
 * can send back. Both the console and the single-court screen ask the same
 * questions and issue the same orders, so they share one hook rather than two
 * copies of the same fetch-and-reload dance.
 *
 * Every command reloads afterwards: the server decides what a result did to the
 * draw and to the court queues, never the client.
 */

export type FinishCommand = { side: Side; resultType: 'WALKOVER' | 'WITHDRAWAL'; reason: string };

/** Lateness is read against a clock that has to move on its own, not on a re-render. */
const CLOCK_TICK_MS = 30_000;

export function useControlConsole(eventId: string) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventResponse, bracketResponse, scheduleResponse] = await Promise.all([
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/schedule`, { cache: 'no-store' }),
      ]);
      const eventData = await eventResponse.json() as { event?: EventDto; error?: string };
      const bracketData = await bracketResponse.json() as { brackets?: BracketDto[]; error?: string };
      const scheduleData = await scheduleResponse.json() as { courts?: CourtDto[]; error?: string };
      if (!eventResponse.ok || !bracketResponse.ok || !scheduleResponse.ok) {
        setError(eventData.error ?? bracketData.error ?? scheduleData.error ?? control.loadError);
      } else {
        setEvent(eventData.event ?? null);
        setBrackets(bracketData.brackets ?? []);
        setCourts(scheduleData.courts ?? []);
        setError('');
      }
    } catch {
      setError(control.loadError);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [control.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load });

  const send = useCallback(async (
    key: string,
    path: string,
    init: { method: string; body: unknown },
    failure: string,
    success?: string,
  ) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(path, { method: init.method, body: JSON.stringify(init.body) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(data.error ?? failure); return false; }
      if (success) setNotice(success);
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy('');
      await load();
    }
  }, [load]);

  const commands = useMemo(() => ({
    start: (match: MatchDto) => send(
      `start-${match.id}`,
      `/api/judge/matches/${match.id}/start`,
      { method: 'POST', body: { expectedVersion: match.version, commandId: createCommandId('match-start') } },
      control.startError,
    ),

    recordResult: (match: MatchDto, setsA: number, setsB: number, commandId: string) => send(
      `result-${match.id}`,
      `/api/judge/matches/${match.id}/result`,
      { method: 'POST', body: { setsA, setsB, expectedVersion: match.version, commandId } },
      control.resultError,
    ),

    finishEarly: (match: MatchDto, form: FinishCommand, winnerEntryId: string) => send(
      `finish-${match.id}`,
      `/api/judge/matches/${match.id}/complete`,
      {
        method: 'POST',
        body: {
          winnerEntryId,
          resultType: form.resultType,
          reason: form.reason,
          expectedVersion: match.version,
          commandId: createCommandId('match-complete'),
        },
      },
      control.finishError,
    ),

    saveTime: (match: MatchDto, isoOrNull: string | null) => {
      const item = match.scheduleItem;
      if (!item) return Promise.resolve(false);
      return send(
        `time-${match.id}`,
        `/api/admin/events/${eventId}/schedule/items/${item.id}`,
        {
          method: 'PATCH',
          body: { plannedStartAt: isoOrNull, expectedVersion: item.version, commandId: createCommandId('schedule-time') },
        },
        control.timeError,
        control.timeSaved,
      );
    },

    /**
     * One place either way in the court queue. The server pins started and
     * finished items, so it is the authority on whether the order it is sent is
     * legal — this only declines to ask when there is nowhere to move.
     */
    move: (lane: CourtLane, itemId: string, delta: number) => {
      const order = reorderedQueue(lane, itemId, delta);
      if (!order) return Promise.resolve(false);
      const versions = new Map(lane.court.scheduleItems.map((item) => [item.id, item.version]));
      return send(
        `move-${itemId}`,
        `/api/admin/events/${eventId}/schedule/reorder`,
        {
          method: 'POST',
          body: {
            courtId: lane.court.id,
            items: order.map((id) => ({ id, version: versions.get(id) ?? 0 })),
            commandId: createCommandId('schedule-reorder'),
          },
        },
        control.reorderError,
        control.reorderSaved,
      );
    },
  }), [control, eventId, send]);

  const board = useMemo(() => buildRunBoard(brackets, courts, now), [brackets, courts, now]);

  return {
    board,
    brackets,
    busy,
    clearError: () => setError(''),
    clearNotice: () => setNotice(''),
    commands,
    courts,
    error,
    event,
    /** A completed event is read-only until an admin reopens it. */
    locked: event?.status === 'COMPLETED',
    loading,
    notice,
    reload: load,
  };
}

export type ControlConsole = ReturnType<typeof useControlConsole>;
export type ControlCommands = ControlConsole['commands'];
