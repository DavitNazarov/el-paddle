import { beforeEach, describe, expect, it } from 'vitest';
import { ClubApplicationStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { addMinutes, hashSecret } from '../../common/security.js';
import { resetDb } from '../../test/helpers.js';
import { verifyApplicationEmail } from './club-applications.service.js';

beforeEach(resetDb);

const EMAIL = 'applicant@example.test';
const CODE = '424242';

/**
 * Rows are created directly rather than through `startApplication`, which would
 * send a verification email and need a live Resend key.
 */
async function seedApplicationWithCode() {
  const application = await prisma.clubApplication.create({
    data: {
      email: EMAIL,
      name: 'Nino',
      surname: 'Beridze',
      phone: '+995500000001',
      passwordHash: await hashSecret('a-real-enough-password'),
      status: ClubApplicationStatus.PENDING_VERIFICATION,
      expiresAt: addMinutes(60 * 24),
    },
  });
  await prisma.clubApplicationCode.create({
    data: {
      applicationId: application.id,
      codeHash: await hashSecret(CODE),
      expiresAt: addMinutes(30),
    },
  });
  return application;
}

const currentCode = (applicationId: string) =>
  prisma.clubApplicationCode.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } });

describe('verification code attempts (integration)', () => {
  it('burns the code after five wrong guesses', async () => {
    const application = await seedApplicationWithCode();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(verifyApplicationEmail(EMAIL, '000000')).rejects.toThrow(/incorrect/i);
    }
    expect((await currentCode(application.id))?.attemptCount).toBe(4);
    // The code still works right up to the limit.
    expect((await currentCode(application.id))?.usedAt).toBeNull();

    await expect(verifyApplicationEmail(EMAIL, '000000')).rejects.toThrow(/too many/i);
    expect((await currentCode(application.id))?.usedAt).not.toBeNull();
  });

  it('refuses the correct code once it has been burned', async () => {
    await seedApplicationWithCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(verifyApplicationEmail(EMAIL, '000000')).rejects.toThrow();
    }
    // The real code is now worthless — this is the point of the counter.
    await expect(verifyApplicationEmail(EMAIL, CODE)).rejects.toThrow(/no verification code/i);
  });

  it('lets a correct guess through with attempts still on the clock', async () => {
    const application = await seedApplicationWithCode();
    await expect(verifyApplicationEmail(EMAIL, '000000')).rejects.toThrow(/incorrect/i);

    const verified = await verifyApplicationEmail(EMAIL, CODE);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect((await currentCode(application.id))?.usedAt).not.toBeNull();
  });
});
