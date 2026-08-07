import type { Server } from 'socket.io';

let socketServer: Server | null = null;

export function registerSocketServer(server: Server) {
  socketServer = server;
}

export function emitToRoom(room: string, event: string, payload: unknown) {
  socketServer?.to(room).emit(event, payload);
}

/**
 * Anonymous sockets may join this room for any published event, so nothing
 * broadcast into it may carry unpublished data — see `outboxEmissions`.
 */
export const eventRoom = (eventId: string) => `event:${eventId}`;

/**
 * Authenticated counterpart of `eventRoom`: admins, organisers of this event
 * and judges holding a live court assignment. Unpublished scores, winners and
 * registration decisions travel only here.
 */
export const eventStaffRoom = (eventId: string) => `event-staff:${eventId}`;

