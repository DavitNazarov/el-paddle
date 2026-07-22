import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSharedCookieDomain } from '../common/cookie-domain.js';

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
    process.env[key] ??= value;
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
  if (isProduction && /postgres(?:ql)?:\/\/[^:]+:[^@]*(password|changeme|change-me|example)[^@]*@/i.test(url)) {
    throw new Error('DATABASE_URL contains a placeholder password.');
  }
  return url;
}

const isProduction = process.env.NODE_ENV === 'production';

function requireHttpsUrl(name: string, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (isProduction && url.protocol !== 'https:') {
    throw new Error(`${name} must use https:// in production.`);
  }
  return url.toString().replace(/\/$/, '');
}

function parseFrontendUrls(raw: string) {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error('FRONTEND_URL is required.');
  }
  const urls = parts.map((value, index) =>
    requireHttpsUrl(parts.length === 1 ? 'FRONTEND_URL' : `FRONTEND_URL[${index}]`, value),
  );
  return [...new Set(urls)];
}

function optionalStrongSecret(name: string, value: string) {
  if (!value) return '';
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters when set.`);
  return value;
}

if (isProduction && !process.env.RESEND_API_KEY?.trim()) {
  throw new Error('RESEND_API_KEY is required in production so account emails fail closed at startup.');
}

const configuredPort = numberEnv('PORT', 4000);
const configuredFrontendUrls = parseFrontendUrls(
  process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
);
const configuredBackendUrl = process.env.BACKEND_URL ?? `http://localhost:${configuredPort}`;
const configuredGoogleRedirectUri =
  process.env.GOOGLE_REDIRECT_URI ??
  `${requireHttpsUrl('BACKEND_URL', configuredBackendUrl)}/api/auth/google/callback`;

const configuredBackendUrlNormalized = requireHttpsUrl('BACKEND_URL', configuredBackendUrl);

export const config = {
  isProduction,
  port: configuredPort,
  /** Primary site origin used for email links and OAuth return redirects. */
  frontendUrl: configuredFrontendUrls[0],
  /** All browser origins allowed by CORS / CSRF / Socket.IO. */
  frontendUrls: configuredFrontendUrls,
  backendUrl: configuredBackendUrlNormalized,
  /**
   * Shared cookie Domain for split site/API hosts (e.g. `.elpadell.com`).
   * Required so Next.js SSR on the site origin can read the API session cookie.
   * Auto-derived when FRONTEND_URL and BACKEND_URL share a parent; override with COOKIE_DOMAIN.
   */
  cookieDomain: resolveSharedCookieDomain({
    cookieDomain: process.env.COOKIE_DOMAIN,
    frontendUrls: configuredFrontendUrls,
    backendUrl: configuredBackendUrlNormalized,
  }),
  databaseUrl: requireDatabaseUrl(),
  jwtSecret: requireJwtSecret(),
  adminEmails: process.env.ADMIN_EMAILS ?? '',
  firstAdminBootstrapToken: optionalStrongSecret(
    'FIRST_ADMIN_BOOTSTRAP_TOKEN',
    process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN ?? '',
  ),
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'El Padel <onboarding@resend.dev>',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: requireHttpsUrl('GOOGLE_REDIRECT_URI', configuredGoogleRedirectUri),
  isAllowedFrontendOrigin(origin: string | undefined) {
    if (!origin) return false;
    return configuredFrontendUrls.includes(origin);
  },
};
