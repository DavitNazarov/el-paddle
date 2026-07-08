import 'dotenv/config';

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: numberEnv('PORT', 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${numberEnv('PORT', 4000)}`,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  adminEmails: process.env.ADMIN_EMAILS ?? '',
  firstAdminBootstrapToken: process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN ?? '',
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'El Padel <onboarding@resend.dev>',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.BACKEND_URL ?? `http://localhost:${numberEnv('PORT', 4000)}`}/api/auth/google/callback`,
};
