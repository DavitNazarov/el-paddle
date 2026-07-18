import type { Server } from 'socket.io';

let socketServer: Server | null = null;

export function registerSocketServer(server: Server) {
  socketServer = server;
}

export function emitToRoom(room: string, event: string, payload: unknown) {
  socketServer?.to(room).emit(event, payload);
}

