'use client';

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api';

const tournamentEvents = [
  'event.status.updated', 'registration.status.updated', 'opponent-request.created',
  'opponent-request.accepted', 'opponent-request.refused', 'opponent-request.withdrawn',
  'opponent-request.admin-approve', 'opponent-request.admin-reject', 'opponent-request.admin-override',
  'bracket.generated', 'bracket.locked', 'bracket.published', 'bracket.updated', 'schedule.updated',
  'schedule.published', 'court.queue.updated', 'match.started', 'match.score.updated',
  'match.set.decided', 'match.result.recorded', 'match.set.undone', 'match.reopened', 'match.config.updated',
  'match.completed', 'match.corrected', 'notification.created',
  // Pre-rename topics, kept for one release so outbox rows enqueued before the
  // slot -> set deploy still reach the UI as they drain. Drop these next release.
  'match.slot.decided', 'match.slot.undone',
];

/**
 * Every topic is an invalidation signal: refetch the authoritative record rather than trusting
 * the payload. `paused` holds refetches back while the user is mid-drag and flushes on release,
 * so a list cannot reshuffle under the pointer.
 */
export function useTournamentRealtime(input: { eventId?: string; matchId?: string; onChange: () => void; paused?: boolean }) {
  const paused = input.paused ?? false;
  const pausedRef = useRef(paused);
  const pendingRef = useRef(false);
  const onChangeRef = useRef(input.onChange);

  // Keep the socket subscription stable while still calling the latest handler.
  useEffect(() => {
    pausedRef.current = paused;
    onChangeRef.current = input.onChange;
  });

  useEffect(() => {
    const socket = io(API_BASE_URL, { withCredentials: true });
    if (input.eventId) socket.emit('subscribe:event', input.eventId);
    if (input.matchId) socket.emit('subscribe:match', input.matchId);
    let timer: number | undefined;
    const invalidate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (pausedRef.current) { pendingRef.current = true; return; }
        onChangeRef.current();
      }, 120);
    };
    for (const event of tournamentEvents) socket.on(event, invalidate);
    return () => {
      window.clearTimeout(timer);
      socket.disconnect();
    };
  }, [input.eventId, input.matchId]);

  useEffect(() => {
    if (paused || !pendingRef.current) return;
    pendingRef.current = false;
    onChangeRef.current();
  }, [paused]);
}
