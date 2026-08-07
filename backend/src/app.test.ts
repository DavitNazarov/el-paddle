import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { config } from './config/env.js';

// In-process integration tests against the real Express app. These exercise the
// security middleware chain (CSRF double-submit + origin allowlist) and the
// anonymous authorization boundary. They deliberately hit routes that reject
// before touching the database, so no test Postgres is required (§14).
const app = createApp();
const ORIGIN = config.frontendUrls[0];

describe('CSRF guard (integration)', () => {
  it('rejects an unsafe request with no CSRF token (403)', async () => {
    const res = await request(app).post('/api/events').set('Origin', ORIGIN).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  it('rejects an unsafe request from a disallowed origin (403)', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Origin', 'https://evil.example.com')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/origin/i);
  });

  it('rejects an unsafe request that declares no origin at all (403)', async () => {
    // A browser always sends Origin on an unsafe method. A request without one
    // is either a non-browser client or a stripped forgery, and the
    // double-submit token alone cannot tell them apart — the CSRF cookie is
    // writable by every host under the shared cookie domain.
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent.post('/api/events').set('x-csrf-token', csrf.body.token).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/origin/i);
  });

  it('accepts a same-site Referer when Origin is absent', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent
      .post('/api/events')
      .set('Referer', `${ORIGIN}/admin/events`)
      .set('x-csrf-token', csrf.body.token)
      .send({});
    // Past the guard; refused later for having no session.
    expect(res.status).toBe(401);
  });

  it('rejects a cross-site Referer when Origin is absent', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent
      .post('/api/events')
      .set('Referer', 'https://evil.example.com/attack')
      .set('x-csrf-token', csrf.body.token)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/origin/i);
  });

  it('rejects a mismatched double-submit token (403)', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/csrf'); // sets the CSRF cookie on the agent
    const res = await agent
      .post('/api/events')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', 'not-the-cookie-value')
      .send({});
    expect(res.status).toBe(403);
  });

  it('passes CSRF with a valid double-submit token, then blocks the anonymous caller (401)', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    expect(csrf.status).toBe(200);
    const token = csrf.body.token as string;
    expect(typeof token).toBe('string');
    // Same value in cookie (set by the agent) and header ⇒ CSRF passes; no session ⇒ 401.
    const res = await agent.post('/api/events').set('Origin', ORIGIN).set('x-csrf-token', token).send({});
    expect(res.status).toBe(401);
  });

  it('allows safe methods through without a token', async () => {
    const res = await request(app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
  });
});

describe('admission control (integration)', () => {
  // New signups must go through /api/applications, which an admin reviews. A
  // direct register/verify pair minted an ACTIVE account with no review, and let
  // an unauthenticated caller plant a password hash on someone else's address.
  // These must stay unmounted, not merely unused by the frontend.
  it.each(['/api/auth/register', '/api/auth/verify'])('does not mount %s', async (path) => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent
      .post(path)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', csrf.body.token)
      .send({ email: 'someone@example.test', password: 'correct-horse-battery', code: '123456' });
    expect(res.status).toBe(404);
  });

  it('still mounts the reviewed application route', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent
      .post('/api/applications')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', csrf.body.token)
      .send({});
    expect(res.status).not.toBe(404);
  });
});

describe('authorization boundary (integration)', () => {
  it('returns 401 for a capability-gated GET without a session cookie', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a capability-gated mutation once CSRF passes but no session is present', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const res = await agent
      .patch('/api/admin/events/evt_missing/status')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', csrf.body.token)
      .send({ status: 'ONGOING' });
    expect(res.status).toBe(401);
  });

  it('rejects a forged session cookie (401)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', 'elpadel_session=not-a-valid-jwt');
    expect(res.status).toBe(401);
  });
});
