import http from 'http';
import { UserRole } from './generated/prisma/client.js';
import { config } from './config/env.js';
import { prisma } from './database/prisma.js';
import { createRealtimeGateway } from './realtime/gateway.js';
import { startOutboxWorker } from './workers/outbox.worker.js';
import { createApp } from './app.js';

const app = createApp();

async function assertBootstrapTokenSafe() {
  if (!config.firstAdminBootstrapToken) return;

  const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  if (adminCount === 0) return;

  const message =
    'FIRST_ADMIN_BOOTSTRAP_TOKEN is still set but an admin already exists. Remove it from the environment and restart.';
  if (config.isProduction) {
    throw new Error(message);
  }
  console.warn(`[config] ${message}`);
}

await assertBootstrapTokenSafe();

const server = http.createServer(app);
createRealtimeGateway(server);
if (process.env.RUN_OUTBOX_IN_API !== 'false') {
  startOutboxWorker({
    mode: config.isProduction ? 'realtime' : 'all',
    expireOpponentRequests: !config.isProduction,
  });
}

server.listen(config.port, () => {
  console.log(`El Padel backend listening on http://localhost:${config.port}`);
});
