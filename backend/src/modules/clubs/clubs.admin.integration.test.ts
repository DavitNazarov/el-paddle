import { beforeEach, describe, expect, it } from 'vitest';
import {
  EventStatus,
  NotificationType,
  RegistrationStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import {
  authedSend,
  createAdmin,
  createCategory,
  createEvent,
  createTeam,
  createUser,
  registerTeam,
  resetDb,
} from '../../test/helpers.js';
import { CLUB_DELETION_AUDIT_ACTION } from './clubs.service.js';

const app = createApp();

beforeEach(resetDb);

const profile = {
  name: 'Vake Padel',
  slug: 'vake-padel',
  description: 'A club from Vake.',
  logoUrl: 'https://example.test/logo.png',
};

describe('admin club editing (integration)', () => {
  it('rejects anonymous, player, and organiser callers', async () => {
    const club = await prisma.club.create({ data: { name: 'Old', slug: 'old' } });

    expect((await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, undefined, profile)).status).toBe(401);
    expect((await authedSend(app, 'delete', `/api/admin/clubs/${club.id}`, undefined)).status).toBe(401);

    const player = await createUser();
    expect((await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, player, profile)).status).toBe(403);
    expect((await authedSend(app, 'delete', `/api/admin/clubs/${club.id}`, player)).status).toBe(403);

    // Organisers hold no club power, even for a club playing their event.
    const organiser = await createUser({ role: UserRole.ORGANISER });
    expect((await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, organiser, profile)).status).toBe(403);
    expect((await authedSend(app, 'delete', `/api/admin/clubs/${club.id}`, organiser)).status).toBe(403);

    expect(await prisma.club.findUnique({ where: { id: club.id } })).not.toBeNull();
  });

  it('updates the profile and audits the change', async () => {
    const admin = await createAdmin();
    const club = await prisma.club.create({ data: { name: 'Old name', slug: 'old-name' } });

    const res = await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, admin, profile);

    expect(res.status).toBe(200);
    expect(res.body.club).toMatchObject(profile);
    const stored = await prisma.club.findUniqueOrThrow({ where: { id: club.id } });
    expect(stored.slug).toBe('vake-padel');

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'club.updated' } });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.before).toMatchObject({ name: 'Old name', slug: 'old-name' });
    expect(audit.after).toMatchObject({ name: 'Vake Padel', slug: 'vake-padel' });
  });

  it('refuses a name-only edit, an unsafe logo link, and a taken slug', async () => {
    const admin = await createAdmin();
    const club = await prisma.club.create({ data: { name: 'Keep', slug: 'keep' } });
    await prisma.club.create({ data: { name: 'Taken', slug: 'taken' } });

    const short = await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, admin, { ...profile, name: 'A' });
    expect(short.status).toBe(400);

    const badLogo = await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, admin, {
      ...profile,
      logoUrl: 'javascript:alert(1)',
    });
    expect(badLogo.status).toBe(400);

    const taken = await authedSend(app, 'patch', `/api/admin/clubs/${club.id}`, admin, { ...profile, slug: 'taken' });
    expect(taken.status).toBe(409);

    const stored = await prisma.club.findUniqueOrThrow({ where: { id: club.id } });
    expect(stored).toMatchObject({ name: 'Keep', slug: 'keep' });
  });

  it('reports a missing club as 404', async () => {
    const admin = await createAdmin();
    expect((await authedSend(app, 'patch', '/api/admin/clubs/missing-id', admin, profile)).status).toBe(404);
    expect((await authedSend(app, 'delete', '/api/admin/clubs/missing-id', admin)).status).toBe(404);
  });
});

describe('admin club deletion (integration)', () => {
  it('deletes the club, releases its members, and leaves one audit row', async () => {
    const admin = await createAdmin();
    const { club, owner, teammate } = await createTeam('Vake');

    const res = await authedSend(app, 'delete', `/api/admin/clubs/${club.id}`, admin);

    expect(res.status).toBe(200);
    expect(await prisma.club.findUnique({ where: { id: club.id } })).toBeNull();
    expect(await prisma.clubMember.count({ where: { clubId: club.id } })).toBe(0);
    // The players themselves survive; they simply have no club.
    expect(await prisma.user.count({ where: { id: { in: [owner.id, teammate.id] } } })).toBe(2);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: CLUB_DELETION_AUDIT_ACTION },
    });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.entityId).toBe(club.id);
    expect(audit.before).toMatchObject({ name: club.name, memberCount: 2 });

    const notifications = await prisma.notification.findMany({
      where: { type: NotificationType.CLUB_MEMBERSHIP_REMOVED },
    });
    expect(notifications.map((notification) => notification.recipientUserId).sort()).toEqual(
      [owner.id, teammate.id].sort(),
    );
  });

  it('refuses while a team is entered in an unfinished event', async () => {
    const admin = await createAdmin();
    const category = await createCategory();
    const event = await createEvent({ categoryId: category.id, title: 'Spring Open' });
    const team = await createTeam('Vake');
    await registerTeam(event, category.id, team, RegistrationStatus.APPROVED);

    const res = await authedSend(app, 'delete', `/api/admin/clubs/${team.club.id}`, admin);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Spring Open');
    expect(await prisma.club.findUnique({ where: { id: team.club.id } })).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: CLUB_DELETION_AUDIT_ACTION } })).toBe(0);
  });

  it('allows deletion once the event is finished and keeps the past entry', async () => {
    const admin = await createAdmin();
    const category = await createCategory();
    const event = await createEvent({ categoryId: category.id, status: EventStatus.COMPLETED });
    const team = await createTeam('Vake');
    const registration = await registerTeam(event, category.id, team, RegistrationStatus.APPROVED);

    const res = await authedSend(app, 'delete', `/api/admin/clubs/${team.club.id}`, admin);

    expect(res.status).toBe(200);
    const stored = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(stored.clubId).toBeNull();
    expect(stored.status).toBe(RegistrationStatus.APPROVED);
  });
});
