import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashSecret } from '../../common/security.js';
import {
  authedGet,
  authedSend,
  createAdmin,
  createJudge,
  createUser,
  resetDb,
} from '../../test/helpers.js';

const app = createApp();
const PASSWORD = 'current-password-123';
const NEW_PASSWORD = 'brand-new-password-456';

beforeEach(resetDb);

async function withPassword(user: { id: string }) {
  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashSecret(PASSWORD) },
  });
}

describe('self-service account settings (integration)', () => {
  it('rejects anonymous callers', async () => {
    expect((await request(app).get('/api/account/profile')).status).toBe(401);
    expect((await authedSend(app, 'patch', '/api/account/profile', undefined, {
      name: 'A', surname: 'B', phone: '+995500000000',
    })).status).toBe(401);
    expect((await authedSend(app, 'post', '/api/account/password', undefined, {
      currentPassword: PASSWORD, newPassword: NEW_PASSWORD,
    })).status).toBe(401);
  });

  it('returns the caller their own editable fields, never the password hash', async () => {
    const player = await withPassword(await createUser({ name: 'Nino', surname: 'Beridze' }));
    const res = await authedGet(app, '/api/account/profile', player);

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      email: player.email,
      name: 'Nino',
      surname: 'Beridze',
      hasPassword: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('reports hasPassword false for an account that only signs in with Google', async () => {
    const player = await createUser();
    const res = await authedGet(app, '/api/account/profile', player);
    expect(res.body.profile.hasPassword).toBe(false);
  });

  it.each([
    ['player', () => createUser()],
    ['judge', () => createJudge()],
    ['admin', () => createAdmin()],
  ])('lets a %s edit their own name, surname, and phone', async (_label, make) => {
    const user = await make();
    const res = await authedSend(app, 'patch', '/api/account/profile', user, {
      name: 'Updated',
      surname: 'Person',
      phone: '+995599112233',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Updated', surname: 'Person', phone: '+995599112233' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.name).toBe('Updated');
    expect(stored.phone).toBe('+995599112233');
  });

  it('never lets a profile edit change email, role, or status', async () => {
    const player = await createUser();
    const res = await authedSend(app, 'patch', '/api/account/profile', player, {
      name: 'Updated',
      surname: 'Person',
      phone: '+995599112233',
      email: 'attacker@example.test',
      role: UserRole.ADMIN,
      status: 'INACTIVE',
    });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(stored.email).toBe(player.email);
    expect(stored.role).toBe(UserRole.USER);
    expect(stored.status).toBe(player.status);
  });

  it('requires a name and keeps a player reachable by phone', async () => {
    const player = await createUser();

    const noName = await authedSend(app, 'patch', '/api/account/profile', player, {
      name: '', surname: 'Person', phone: '+995599112233',
    });
    expect(noName.status).toBe(400);

    const noPhone = await authedSend(app, 'patch', '/api/account/profile', player, {
      name: 'Updated', surname: 'Person', phone: '',
    });
    expect(noPhone.status).toBe(400);
  });

  it('lets staff clear the optional phone number', async () => {
    const judge = await createJudge();
    const res = await authedSend(app, 'patch', '/api/account/profile', judge, {
      name: 'Judge', surname: 'Person', phone: '',
    });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: judge.id } });
    expect(stored.phone).toBeNull();
  });

  it('changes a password when the current one matches and keeps this device signed in', async () => {
    const admin = await withPassword(await createAdmin());
    const res = await authedSend(app, 'post', '/api/account/password', admin, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    // Every outstanding session is invalidated...
    expect(stored.sessionVersion).toBe(admin.sessionVersion + 1);
    // ...but the caller gets a cookie for the bumped version back.
    const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(cookies.some((cookie) => cookie.startsWith('elpadel_session='))).toBe(true);

    const login = await authedSend(app, 'post', '/api/auth/login', undefined, {
      email: admin.email,
      password: NEW_PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it('refuses a wrong current password and leaves the old one working', async () => {
    const player = await withPassword(await createUser());
    const res = await authedSend(app, 'post', '/api/account/password', player, {
      currentPassword: 'not-the-password',
      newPassword: NEW_PASSWORD,
    });

    expect(res.status).toBe(401);
    const login = await authedSend(app, 'post', '/api/auth/login', undefined, {
      email: player.email,
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it('rejects a new password that is too short', async () => {
    const player = await withPassword(await createUser());
    const res = await authedSend(app, 'post', '/api/account/password', player, {
      currentPassword: PASSWORD,
      newPassword: 'short',
    });

    expect(res.status).toBe(400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(stored.sessionVersion).toBe(player.sessionVersion);
  });

  it('lets a Google-only account set its first password without a current one', async () => {
    const player = await createUser();
    const res = await authedSend(app, 'post', '/api/account/password', player, {
      newPassword: NEW_PASSWORD,
    });

    expect(res.status).toBe(200);
    const login = await authedSend(app, 'post', '/api/auth/login', undefined, {
      email: player.email,
      password: NEW_PASSWORD,
    });
    expect(login.status).toBe(200);
  });
});
