import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { UserRole } from './generated/prisma/client.js';
import { config } from './config/env.js';
import { handleError } from './common/http.js';
import { securityHeaders } from './common/securityHeaders.js';
import { prisma } from './database/prisma.js';
import { router } from './routes.js';
import { createRealtimeGateway } from './realtime/gateway.js';
import { startOutboxWorker } from './workers/outbox.worker.js';
import { csrfGuard, issueCsrfToken } from './common/csrf.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(compression({ threshold: 1024 }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.isAllowedFrontendOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.get('/api/auth/csrf', issueCsrfToken);
app.use(csrfGuard);
app.use(router);
app.use(handleError);

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
