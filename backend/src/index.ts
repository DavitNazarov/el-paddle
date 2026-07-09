import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { UserRole } from './generated/prisma/client.js';
import { config } from './config/env.js';
import { handleError } from './common/http.js';
import { securityHeaders } from './common/securityHeaders.js';
import { prisma } from './database/prisma.js';
import { router } from './routes.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
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

app.listen(config.port, () => {
  console.log(`El Padel backend listening on http://localhost:${config.port}`);
});
