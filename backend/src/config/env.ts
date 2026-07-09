import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');
const monorepoRoot = path.resolve(backendRoot, '..');

function loadEnvFile(filePath: string) {
  let contents = '';
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const parsed = dotenv.parse(contents);
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') continue;
    if (value.trim() === '') continue;
    process.env[key] = value;
  }
}

// Load root first, then backend. Empty values are ignored so they cannot wipe secrets.
loadEnvFile(path.join(monorepoRoot, '.env'));
loadEnvFile(path.join(backendRoot, '.env'));

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const WEAK_JWT_SECRETS = new Set([
  'replace-with-a-long-random-secret',
  'secret',
  'changeme',
  'change-me',
  'jwt-secret',
  'your-secret',
  'your-secret-here',
]);

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim() ?? '';
  if (!secret) {
    throw new Error('JWT_SECRET is required. Set a strong random value in the environment.');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }
  if (WEAK_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET is a known placeholder. Generate a strong random secret.');
  }
  return secret;
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? '';
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }
  return url;
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.RESEND_API_KEY?.trim()) {
  console.warn(
    '[config] RESEND_API_KEY is empty in production. Auth emails will fail until it is set.',
  );
}

export const config = {
  isProduction,
  port: numberEnv('PORT', 4000),
  frontendUrl: process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${numberEnv('PORT', 4000)}`,
  databaseUrl: requireDatabaseUrl(),
  jwtSecret: requireJwtSecret(),
  adminEmails: process.env.ADMIN_EMAILS ?? '',
  firstAdminBootstrapToken: process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN ?? '',
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'El Padel <onboarding@resend.dev>',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.BACKEND_URL ?? `http://localhost:${numberEnv('PORT', 4000)}`}/api/auth/google/callback`,
};
