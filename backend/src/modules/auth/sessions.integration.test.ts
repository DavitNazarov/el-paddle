import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashSecret } from '../../common/security.js';
import { allowedOrigin, createUser, getCsrf, resetDb, sessionCookie } from '../../test/helpers.js';

const app = createApp();
const PASSWORD = 'a-perfectly-fine-password';

beforeEach(resetDb);

async function signedInDevice() {
  const user = await createUser();
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashSecret(PASSWORD) } });
  return { user, cookie: await sessionCookie(user) };
}

const post = async (path: string, cookie: string) => {
  const csrf = await getCsrf(app);
  return request(app)
    .post(path)
    .set('Cookie', [csrf.cookie, cookie].join('; '))
    .set('Origin', allowedOrigin())
    .set('x-csrf-token', csrf.token)
    .send({});
};

const me = (cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie);

/**
 * Signing out used to bump `sessionVersion`, which invalidated every token the
 * account had — logging out of a laptop signed out the phone. A device now has
 * its own revocable record, and signing out everywhere is a separate, explicit
 * action.
 */
describe('per-device sessions (integration)', () => {
  it('signs out only the device that logged out', async () => {
    const { user } = await signedInDevice();
    const laptop = await sessionCookie(user);
    const phone = await sessionCookie(user);

    expect((await me(laptop)).body.user).not.toBeNull();
    expect((await me(phone)).body.user).not.toBeNull();

    expect((await post('/api/auth/logout', laptop)).status).toBe(200);

    expect((await me(laptop)).body.user).toBeNull();
    // The whole point: the other device is untouched.
    expect((await me(phone)).body.user).not.toBeNull();
  });

  it('signs out every device on log-out-all', async () => {
    const { user } = await signedInDevice();
    const laptop = await sessionCookie(user);
    const phone = await sessionCookie(user);

    expect((await post('/api/auth/logout-all', laptop)).status).toBe(200);

    expect((await me(laptop)).body.user).toBeNull();
    expect((await me(phone)).body.user).toBeNull();
  });

  it('refuses log-out-all without a session', async () => {
    const csrf = await getCsrf(app);
    const response = await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', csrf.cookie)
      .set('Origin', allowedOrigin())
      .set('x-csrf-token', csrf.token)
      .send({});
    expect(response.status).toBe(401);
  });

  it('refuses a token whose session row was deleted outright', async () => {
    const { user } = await signedInDevice();
    const cookie = await sessionCookie(user);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    expect((await me(cookie)).body.user).toBeNull();
  });

  it('refuses a session past its expiry even before cleanup removes it', async () => {
    const { user } = await signedInDevice();
    const cookie = await sessionCookie(user);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await me(cookie)).body.user).toBeNull();
  });

  it('keeps the account-wide revoke working for disqualification', async () => {
    const { user } = await signedInDevice();
    const laptop = await sessionCookie(user);
    const phone = await sessionCookie(user);

    // What setUserDisqualification's revokeUserSessions does.
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });

    expect((await me(laptop)).body.user).toBeNull();
    expect((await me(phone)).body.user).toBeNull();
  });

  it('leaves the caller signed in after a password change but drops other devices', async () => {
    const { user } = await signedInDevice();
    const laptop = await sessionCookie(user);
    const phone = await sessionCookie(user);

    const csrf = await getCsrf(app);
    const response = await request(app)
      .post('/api/account/password')
      .set('Cookie', [csrf.cookie, laptop].join('; '))
      .set('Origin', allowedOrigin())
      .set('x-csrf-token', csrf.token)
      .send({ currentPassword: PASSWORD, newPassword: 'an-entirely-new-password' });
    expect(response.status).toBe(200);

    const reissued = (response.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('elpadel_session='));
    expect(reissued).toBeDefined();
    // The device that made the change keeps working via its new cookie…
    expect((await me(reissued!.split(';')[0])).body.user).not.toBeNull();
    // …and every other device, including the old cookie, is out.
    expect((await me(laptop)).body.user).toBeNull();
    expect((await me(phone)).body.user).toBeNull();
  });
});
