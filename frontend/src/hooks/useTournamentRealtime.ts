'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api';

const tournamentEvents = [
  'event.status.updated', 'registration.status.updated', 'opponent-request.created',
  'opponent-request.accepted', 'opponent-request.refused', 'opponent-request.withdrawn',
  'opponent-request.admin-approve', 'opponent-request.admin-reject', 'opponent-request.admin-override',
  'bracket.generated', 'bracket.locked', 'bracket.published', 'schedule.updated',
  'schedule.published', 'court.queue.updated', 'match.started', 'match.score.updated',
  'match.completed', 'notification.created',
];

export function useTournamentRealtime(input: { eventId?: string; matchId?: string; onChange: () => void }) {
  useEffect(() => {
    const socket = io(API_BASE_URL, { withCredentials: true });
    if (input.eventId) socket.emit('subscribe:event', input.eventId);
    if (input.matchId) socket.emit('subscribe:match', input.matchId);
    let timer: number | undefined;
    const invalidate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(input.onChange, 120);
    };
    for (const event of tournamentEvents) socket.on(event, invalidate);
    return () => {
      window.clearTimeout(timer);
      socket.disconnect();
    };
  }, [input.eventId, input.matchId, input.onChange]);
}
