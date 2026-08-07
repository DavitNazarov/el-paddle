import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { UserStatus } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashSecret, hashToken } from '../../common/security.js';
import { allowedOrigin, createUser, getCsrf, resetDb, sessionCookie } from '../../test/helpers.js';

// The reset email is the only place the raw token exists, and delivery needs a
// live Resend key. Capturing the sender keeps these tests about the token rules.
const sent: { email: string; token: string }[] = [];
vi.mock('../../common/notifications.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../common/notifications.js')>()),
  sendPasswordResetEmail: async (email: string, token: string) => {
    sent.push({ email, token });
  },
}));

const app = createApp();
const OLD_PASSWORD = 'the-old-password-here';
const NEW_PASSWORD = 'a-brand-new-password';

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

async function activePlayer() {
  const user = await createUser();
  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashSecret(OLD_PASSWORD) },
  });
}

async function send(path: string, body: Record<string, unknown>) {
  const csrf = await getCsrf(app);
  return request(app)
    .post(path)
    .set('Cookie', csrf.cookie)
    .set('Origin', allowedOrigin())
    .set('x-csrf-token', csrf.token)
    .send(body);
}

const requestReset = (email: string) => send('/api/auth/password-reset', { email });
const completeReset = (token: string, password: string) =>
  send('/api/auth/password-reset/complete', { token, password });

describe('password reset (integration)', () => {
  it('answers identically whether or not the address has an account', async () => {
    const user = await activePlayer();
    const known = await requestReset(user.email);
    const unknown = await requestReset('nobody@example.invalid');

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    // The response is the same; only one of them actually mailed anything.
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe(user.email);
  });

  it('stores only a hash of the token', async () => {
    const user = await activePlayer();
    await requestReset(user.email);

    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.tokenHash).not.toBe(sent[0].token);
    expect(row.tokenHash).toBe(hashToken(sent[0].token));
  });

  it('sets the new password and signs every device out', async () => {
    const user = await activePlayer();
    const laptop = await sessionCookie(user);
    await requestReset(user.email);

    expect((await completeReset(sent[0].token, NEW_PASSWORD)).status).toBe(200);

    // Whoever knew the old password is out — that is why the reset happened.
    expect((await request(app).get('/api/auth/me').set('Cookie', laptop)).body.user).toBeNull();

    const login = await send('/api/auth/login', { email: user.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    const stale = await send('/api/auth/login', { email: user.email, password: OLD_PASSWORD });
    expect(stale.status).toBe(401);
  });

  it('burns the link after one use', async () => {
    const user = await activePlayer();
    await requestReset(user.email);
    const { token } = sent[0];

    expect((await completeReset(token, NEW_PASSWORD)).status).toBe(200);
    const replay = await completeReset(token, 'yet-another-password-x');
    expect(replay.status).toBe(400);
    expect(replay.body.error).toMatch(/no longer valid/i);
  });

  it('retires the previous link when a new one is requested', async () => {
    const user = await activePlayer();
    await requestReset(user.email);
    await requestReset(user.email);
    expect(sent).toHaveLength(2);

    const superseded = await completeReset(sent[0].token, NEW_PASSWORD);
    expect(superseded.status).toBe(400);
    expect((await completeReset(sent[1].token, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses an expired link', async () => {
    const user = await activePlayer();
    await requestReset(user.email);
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await completeReset(sent[0].token, NEW_PASSWORD)).status).toBe(400);
  });

  it('refuses a forged token', async () => {
    expect((await completeReset('not-a-real-token', NEW_PASSWORD)).status).toBe(400);
  });

  it('enforces the password rules on the new password', async () => {
    const user = await activePlayer();
    await requestReset(user.email);
    const response = await completeReset(sent[0].token, 'short');
    expect(response.status).toBe(400);
    // Rejected before the token is spent, so a typo does not cost the link.
    expect((await completeReset(sent[0].token, NEW_PASSWORD)).status).toBe(200);
  });

  it('does not issue a link for an account that is not active', async () => {
    const user = await activePlayer();
    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.INVITED } });
    await requestReset(user.email);
    expect(sent).toHaveLength(0);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });
});
