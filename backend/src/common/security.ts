import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function createVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

export async function hashSecret(secret: string) {
  return bcrypt.hash(secret, 12);
}

export async function compareSecret(secret: string, hash: string) {
  return bcrypt.compare(secret, hash);
}

export function createInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function addHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

export function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function timingSafeEqualString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}
