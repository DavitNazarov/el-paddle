import { Router } from 'express';
import { OutboxStatus } from '../../generated/prisma/client.js';
import { asyncHandler } from '../../common/http.js';
import { prisma } from '../../database/prisma.js';

export const healthRouter = Router();

/**
 * Liveness: the process is up and answering. Deliberately touches nothing else,
 * so a load balancer never restarts a healthy API because the database blipped.
 */
healthRouter.get('/health', (_request, response) => {
  response.json({ ok: true });
});

/**
 * Readiness: can this process actually serve a request?
 *
 * `/health` answered "the process is running", which a deploy cannot be verified
 * against — an API that cannot reach its database answers it perfectly. This one
 * asks the database, and reports the outbox backlog alongside, because a queue
 * that has stopped draining is the failure that shows up as "nobody got any
 * emails" three hours later rather than as an error anywhere.
 *
 * 503 when the database is unreachable, so a deployment gate can read the status
 * code and never has to parse the body.
 */
healthRouter.get('/health/ready', asyncHandler(async (_request, response) => {
  const startedAt = Date.now();
  try {
    const [, failed, pending] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.outboxMessage.count({ where: { status: OutboxStatus.FAILED } }),
      prisma.outboxMessage.count({ where: { status: OutboxStatus.PENDING } }),
    ]);
    response.json({
      ok: true,
      database: { ok: true, latencyMs: Date.now() - startedAt },
      outbox: { pending, failed },
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      database: { ok: false },
      error: error instanceof Error ? error.message.slice(0, 200) : 'Database unavailable.',
    });
  }
}));

/**
 * What is actually deployed. Read from the environment the image was built
 * with, so a release can be confirmed without shelling into the host.
 */
healthRouter.get('/api/meta/version', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    version: process.env.APP_VERSION ?? null,
    commit: process.env.GIT_COMMIT ?? null,
    environment: process.env.NODE_ENV ?? 'development',
    startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
  });
});
