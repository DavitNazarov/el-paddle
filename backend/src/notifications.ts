import { RegistrationStatus, type Event, type User } from './generated/prisma/client.js';
import { appUrl, emailLayout, sendEmail } from './email.js';

export async function sendVerificationCodeEmail(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: 'Verify your El Padel account',
    text: `Your El Padel verification code is ${code}. It expires in 30 minutes.`,
    html: emailLayout(
      'Verify your account',
      `<p>Your verification code is:</p>
       <p style="font-size:32px;letter-spacing:.22em;font-weight:700;color:#e0c477">${code}</p>
       <p>This code expires in 30 minutes.</p>`,
    ),
  });
}

export async function sendTeammateAddedEmail(
  teammate: User,
  owner: User,
  event: Event,
) {
  await sendEmail({
    to: teammate.email,
    subject: 'You were added as a teammate',
    text: `${owner.name ?? owner.email} added you as a teammate for ${event.title}.`,
    html: emailLayout(
      'You were added as a teammate',
      `<p>${owner.name ?? owner.email} added you as a teammate for <strong>${event.title}</strong>.</p>
       <p>You can see the registration status in your dashboard.</p>
       <p><a href="${appUrl('/dashboard')}" style="color:#f2e3ad">Open dashboard</a></p>`,
    ),
  });
}

export async function sendTeammateInviteEmail(
  email: string,
  owner: User,
  event: Event,
  token: string,
) {
  await sendEmail({
    to: email,
    subject: 'Your teammate registered you for El Padel',
    text: `${owner.name ?? owner.email} registered you for ${event.title}. Create your password: ${appUrl(`/invite?token=${token}`)}`,
    html: emailLayout(
      'Your teammate registered you',
      `<p>${owner.name ?? owner.email} registered you for <strong>${event.title}</strong>.</p>
       <p>Create your password and finish your profile to access the dashboard.</p>
       <p><a href="${appUrl(`/invite?token=${token}`)}" style="color:#f2e3ad">Create password</a></p>`,
    ),
  });
}

export async function sendRegistrationStatusEmail(
  recipients: User[],
  event: Event,
  status: RegistrationStatus,
  reason?: string | null,
) {
  const statusLabel =
    status === RegistrationStatus.APPROVED
      ? 'approved'
      : status === RegistrationStatus.DECLINED
        ? 'declined'
        : 'moved back to pending';

  await Promise.all(
    recipients.map((user) =>
      sendEmail({
        to: user.email,
        subject: `Registration ${statusLabel}: ${event.title}`,
        text: `Your registration for ${event.title} was ${statusLabel}.${reason ? ` Reason: ${reason}` : ''}`,
        html: emailLayout(
          `Registration ${statusLabel}`,
          `<p>Your registration for <strong>${event.title}</strong> was ${statusLabel}.</p>
           ${reason ? `<p>Reason: ${reason}</p>` : ''}
           <p><a href="${appUrl('/dashboard')}" style="color:#f2e3ad">Open dashboard</a></p>`,
        ),
      }),
    ),
  );
}
