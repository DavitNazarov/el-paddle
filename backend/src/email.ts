import { Resend } from 'resend';
import { config } from './env.js';

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  if (!resend) {
    console.log('[email:dev]', { to, subject, text: text ?? html });
    return;
  }

  await resend.emails.send({
    from: config.resendFromEmail,
    to,
    subject,
    html,
    text,
  });
}

export function appUrl(path = '/') {
  return new URL(path, config.frontendUrl).toString();
}

export function emailLayout(title: string, body: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#130202;color:#f6efe1;padding:32px">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(246,239,225,.2);padding:28px;background:#8c1916">
        <p style="margin:0 0 12px;color:#e0c477;font-size:12px;text-transform:uppercase;letter-spacing:.24em">El Padel</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.1">${title}</h1>
        <div style="font-size:15px;line-height:1.7;color:#f6efe1">${body}</div>
      </div>
    </div>
  `;
}
