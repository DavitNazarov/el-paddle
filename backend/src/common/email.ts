import { Resend } from 'resend';
import { config } from '../config/env.js';
import { ApiError } from './http.js';

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

function assertSafeEmailAddress(address: string) {
  if (!address || /[\r\n]/.test(address) || address.length > 254) {
    throw new ApiError('Invalid email recipient.', 400);
  }
}

function sanitizeSubject(subject: string) {
  return subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

/** Escape untrusted text before interpolating into HTML email bodies. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const recipients = (Array.isArray(to) ? to : [to]).map((item) => item.trim());
  for (const recipient of recipients) assertSafeEmailAddress(recipient);
  const safeSubject = sanitizeSubject(subject);

  if (!resend) {
    if (config.isProduction) {
      throw new ApiError(
        'Email delivery is not configured. Set RESEND_API_KEY in production.',
        503,
      );
    }
    console.log('[email:dev]', { to: recipients, subject: safeSubject, text: text ?? '(html omitted)' });
    return;
  }

  const result = await resend.emails.send({
    from: config.resendFromEmail,
    to: recipients,
    subject: safeSubject,
    html,
    text,
  });

  if (result.error) {
    console.error('[email:resend]', result.error);
    throw new ApiError(
      'Email could not be sent. Check Resend API key and from-address.',
      502,
    );
  }
}

export function appUrl(path = '/') {
  return new URL(path, config.frontendUrl).toString();
}

export function emailLayout(title: string, body: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#130202;color:#f6efe1;padding:32px">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(246,239,225,.2);padding:28px;background:#8c1916">
        <p style="margin:0 0 12px;color:#e0c477;font-size:12px;text-transform:uppercase;letter-spacing:.24em">El Padel</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.1">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.7;color:#f6efe1">${body}</div>
      </div>
    </div>
  `;
}
