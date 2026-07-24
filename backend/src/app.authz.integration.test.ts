import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { authedGet, authedSend, createAdmin, createJudge, createUser, resetDb } from './test/helpers.js';

const app = createApp();

beforeEach(resetDb);

describe('admin authorization matrix (integration, real sessions)', () => {
  const adminRoutes = ['/api/admin/users', '/api/admin/clubs', '/api/admin/judges'];

  it('returns 401 for anonymous callers', async () => {
    for (const route of adminRoutes) {
      const res = await request(app).get(route);
      expect(res.status, route).toBe(401);
    }
  });

  it('returns 403 for an authenticated player without the capability', async () => {
    const player = await createUser();
    for (const route of adminRoutes) {
      const res = await authedGet(app, route, player);
      expect(res.status, route).toBe(403);
    }
  });

  it('returns 403 for a judge on admin-only capability routes', async () => {
    const judge = await createJudge();
    for (const route of adminRoutes) {
      const res = await authedGet(app, route, judge);
      expect(res.status, route).toBe(403);
    }
  });

  it('returns 200 for an admin', async () => {
    const admin = await createAdmin();
    const res = await authedGet(app, '/api/admin/users', admin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    // The pagination change surfaces an additive nextCursor field (M-2).
    expect(res.body).toHaveProperty('nextCursor');
  });
});

describe('mutation authorization + CSRF (integration)', () => {
  it('rejects an authenticated player mutation with 403 (capability), after CSRF passes', async () => {
    const player = await createUser();
    const res = await authedSend(app, 'patch', '/api/admin/events/evt_missing/status', player, {
      status: 'ONGOING',
      expectedVersion: 0,
      commandId: 'cmd-authz-0001',
    });
    expect(res.status).toBe(403);
  });

  it('rejects an anonymous mutation with 401 once CSRF passes', async () => {
    const res = await authedSend(app, 'patch', '/api/admin/events/evt_missing/status', undefined, {
      status: 'ONGOING',
      expectedVersion: 0,
      commandId: 'cmd-authz-0002',
    });
    expect(res.status).toBe(401);
  });
});
