import type { Server as HttpServer } from 'http';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { config } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { SESSION_COOKIE } from '../modules/auth/auth.service.js';
import { registerSocketServer } from './socket.js';

type SocketUser = { id: string; role: string };

const MAX_SOCKET_SUBSCRIPTIONS = 40;
const SOCKET_ACTION_WINDOW_MS = 60_000;
const MAX_SOCKET_ACTIONS_PER_WINDOW = 60;

type RateBucket = { count: number; resetAt: number };

function cookieValue(header: string | undefined, name: string) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

export function isSafeRealtimeId(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9]{8,64}$/i.test(value);
}

function allowSocketAction(socket: Socket) {
  const now = Date.now();
  const current = socket.data.rateBucket as RateBucket | undefined;
  if (!current || current.resetAt <= now) {
    socket.data.rateBucket = { count: 1, resetAt: now + SOCKET_ACTION_WINDOW_MS };
    return true;
  }
  current.count += 1;
  return current.count <= MAX_SOCKET_ACTIONS_PER_WINDOW;
}

function canJoinMoreRooms(socket: Socket, roomName: string) {
  if (socket.rooms.has(roomName)) return true;
  const current = Number(socket.data.subscriptionCount ?? 0);
  if (current >= MAX_SOCKET_SUBSCRIPTIONS) return false;
  socket.data.subscriptionCount = current + 1;
  return true;
}

async function authenticateSocket(socket: Socket) {
  try {
    const token = cookieValue(socket.handshake.headers.cookie, SESSION_COOKIE);
    if (!token) return undefined;
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload & { sub?: string; sv?: number };
    if (!payload.sub) return undefined;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true, sessionVersion: true } });
    if (user?.status === 'ACTIVE' && user.sessionVersion === (payload.sv ?? 0)) return user;
    return undefined;
  } catch {
    return undefined;
  }
}

async function currentSocketUser(socket: Socket) {
  const user = await authenticateSocket(socket);
  if (user) {
    socket.data.user = user;
    return user;
  }
  if (socket.data.user) socket.disconnect(true);
  return undefined;
}

async function canSubscribeToEvent(user: SocketUser | undefined, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { isPublished: true } });
  if (!event) return false;
  if (event.isPublished) return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'JUDGE') {
    const now = new Date();
    return Boolean(await prisma.courtJudgeAssignment.findFirst({
      where: {
        judgeUserId: user.id,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
        court: { eventId },
      },
      select: { id: true },
    }));
  }
  return Boolean(await prisma.eventRegistration.findFirst({ where: { eventId, OR: [{ ownerId: user.id }, { teammateId: user.id }] }, select: { id: true } }));
}

async function canSubscribeToMatch(user: SocketUser | undefined, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      participantA: { select: { ownerId: true, teammateId: true } },
      participantB: { select: { ownerId: true, teammateId: true } },
      scheduleItem: { select: { assignedJudgeId: true, court: { select: { judgeAssignments: { where: { revokedAt: null, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } }, select: { judgeUserId: true } } } } } },
      bracket: { select: { publishedAt: true, event: { select: { schedulePublishedAt: true, publicLiveScoringEnabled: true } } } },
    },
  });
  if (!match) return false;
  const isPubliclyListed = Boolean(match.bracket.publishedAt || (match.scheduleItem && match.bracket.event.schedulePublishedAt));
  if (isPubliclyListed && match.bracket.event.publicLiveScoringEnabled) return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'JUDGE') {
    return match.scheduleItem?.assignedJudgeId === user.id || Boolean(match.scheduleItem?.court.judgeAssignments.some((assignment) => assignment.judgeUserId === user.id));
  }
  return [match.participantA, match.participantB].some((entry) => entry?.ownerId === user.id || entry?.teammateId === user.id);
}

export function createRealtimeGateway(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: config.frontendUrls, credentials: true },
    maxHttpBufferSize: 16 * 1024,
    transports: ['websocket', 'polling'],
  });
  io.use(async (socket, next) => {
    socket.data.user = await authenticateSocket(socket);
    next();
  });
  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser | undefined;
    if (user) {
      void socket.join(`user:${user.id}`);
      if (user.role === 'ADMIN') void socket.join('admins');
      if (user.role === 'JUDGE') void socket.join(`judge:${user.id}`);
    }
    socket.on('subscribe:event', async (eventId: string, acknowledge?: (result: { ok: boolean }) => void) => {
      try {
        if (!allowSocketAction(socket) || !isSafeRealtimeId(eventId)) {
          acknowledge?.({ ok: false });
          return;
        }
        const currentUser = await currentSocketUser(socket);
        const roomName = `event:${eventId}`;
        const allowed = canJoinMoreRooms(socket, roomName) && await canSubscribeToEvent(currentUser, eventId);
        if (allowed) await socket.join(roomName);
        acknowledge?.({ ok: allowed });
      } catch {
        acknowledge?.({ ok: false });
      }
    });
    socket.on('subscribe:match', async (matchId: string, acknowledge?: (result: { ok: boolean }) => void) => {
      try {
        if (!allowSocketAction(socket) || !isSafeRealtimeId(matchId)) {
          acknowledge?.({ ok: false });
          return;
        }
        const currentUser = await currentSocketUser(socket);
        const roomName = `match:${matchId}`;
        const allowed = canJoinMoreRooms(socket, roomName) && await canSubscribeToMatch(currentUser, matchId);
        if (allowed) await socket.join(roomName);
        acknowledge?.({ ok: allowed });
      } catch {
        acknowledge?.({ ok: false });
      }
    });
  });
  registerSocketServer(io);
  return io;
}
