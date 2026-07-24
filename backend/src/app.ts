import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { config } from './config/env.js';
import { handleError } from './common/http.js';
import { securityHeaders } from './common/securityHeaders.js';
import { router } from './routes.js';
import { csrfGuard, issueCsrfToken } from './common/csrf.js';

/**
 * Build the configured Express app (middleware, CSRF guard, routes, error
 * handler) without binding a port or starting workers. Kept separate from
 * index.ts so it can be exercised in-process by integration tests (supertest).
 */
export function createApp() {
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

  return app;
}
