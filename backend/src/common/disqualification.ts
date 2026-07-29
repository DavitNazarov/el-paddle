import type { User } from '../generated/prisma/client.js';
import { jsonError } from './http.js';

export function isDisqualified(user: Pick<User, 'disqualifiedUntil'>) {
  return Boolean(user.disqualifiedUntil && user.disqualifiedUntil.getTime() > Date.now());
}

export function assertNotDisqualified(user: Pick<User, 'disqualifiedUntil' | 'disqualificationReason'>) {
  if (!isDisqualified(user)) return;
  const until = user.disqualifiedUntil!.toISOString().slice(0, 10);
  const reason = user.disqualificationReason?.trim();
  jsonError(
    reason
      ? `You are disqualified until ${until}. Reason: ${reason}`
      : `You are disqualified until ${until}.`,
    403,
  );
}
