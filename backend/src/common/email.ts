import { Resend } from 'resend';
import { config } from '../config/env.js';
import { ApiError } from './http.js';
import { withTimeout } from './timeout.js';

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
	    console.log('[email:dev]', { to: recipients, subject: safeSubject, body: text ? 'omitted' : 'html omitted' });
	    return;
	  }

  const result = await withTimeout(resend.emails.send({
    from: config.resendFromEmail,
    to: recipients,
    subject: safeSubject,
    html,
    text,
  }), 10_000, 'Email provider');

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

type EmailLayoutOptions = {
  preheader?: string;
  eyebrow?: string;
};

type EmailDetail = {
  label: string;
  value: string;
};

/** A client-safe primary action used consistently across all email templates. */
export function emailButton(label: string, url: string) {
  return `<table class="email-button" role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0 8px">
    <tr>
      <td bgcolor="#8c1916" style="border-radius:6px">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;border:1px solid #8c1916;border-radius:6px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;text-decoration:none">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** A restrained information panel for codes, reasons, and other key details. */
export function emailPanel(content: string) {
  return `<div style="margin:24px 0;padding:18px 20px;border:1px solid #e7dfd2;border-radius:6px;background:#faf8f4">${content}</div>`;
}

/** A compact summary that makes the most important information easy to scan. */
export function emailDetails(items: EmailDetail[]) {
  const rows = items.map(({ label, value }, index) => `
    <tr>
      <td style="${index ? 'padding-top:14px;border-top:1px solid #ebe5dc;' : ''}padding-right:20px;color:#766e67;font-family:Arial,sans-serif;font-size:13px;font-weight:700;line-height:20px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
      <td align="right" style="${index ? 'padding-top:14px;border-top:1px solid #ebe5dc;' : ''}color:#29231f;font-family:Arial,sans-serif;font-size:14px;font-weight:600;line-height:20px;vertical-align:top">${escapeHtml(value)}</td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;padding:18px 20px;border:1px solid #e7dfd2;border-radius:6px;background:#faf8f4">${rows}
  </table>`;
}

export function emailLayout(title: string, body: string, options: EmailLayoutOptions = {}) {
  const preheader = escapeHtml(options.preheader ?? title);
  const eyebrow = escapeHtml(options.eyebrow ?? 'El Padel');
  const homeUrl = escapeHtml(appUrl('/'));
  const logoUrl = escapeHtml(appUrl('/images/el-padel-logo.png'));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; supported-color-schemes: light; }
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 20px 12px !important; }
        .email-content { padding: 32px 24px 30px !important; }
        .email-title { font-size: 26px !important; line-height: 33px !important; }
        .email-button, .email-button tbody, .email-button tr, .email-button td { width: 100% !important; }
        .email-button a { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f3f0ea;color:#29231f">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:#f3f0ea">
      <tr>
        <td class="email-shell" align="center" style="padding:36px 16px">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
            <tr>
              <td style="overflow:hidden;border:1px solid #ded7cc;border-radius:10px;background:#ffffff">
                <div style="padding:20px 24px;background:#741512;text-align:center">
                  <a href="${homeUrl}" style="display:inline-block;text-decoration:none">
                    <img src="${logoUrl}" width="112" alt="El Padel" style="display:block;width:112px;max-width:100%;height:auto;border:0;color:#f2df9b;font-family:Arial,sans-serif;font-size:18px;font-weight:700;line-height:28px">
                  </a>
                </div>
                <div class="email-content" style="padding:42px 44px 40px">
                  <p style="margin:0 0 12px;color:#8c1916;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;line-height:18px;text-transform:uppercase">${eyebrow}</p>
                  <h1 class="email-title" style="margin:0 0 22px;color:#211d1a;font-family:Arial,sans-serif;font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:38px">${escapeHtml(title)}</h1>
                  <div style="color:#4f4842;font-family:Arial,sans-serif;font-size:16px;line-height:26px">${body}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 12px 0;color:#766e67;font-family:Arial,sans-serif;font-size:12px;line-height:19px;text-align:center">
                Sent by El Padel to keep you informed about your account and tournaments.<br>
                <a href="${homeUrl}" style="color:#766e67;text-decoration:underline">Visit El Padel</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
