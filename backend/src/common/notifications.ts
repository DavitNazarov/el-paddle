import { RegistrationStatus, type Event, type User } from '../generated/prisma/client.js';
import { appUrl, emailLayout, escapeHtml, sendEmail } from './email.js';

function displayName(user: Pick<User, 'name' | 'email'>) {
  return escapeHtml(user.name?.trim() || user.email);
}

export async function sendVerificationCodeEmail(email: string, code: string) {
  const safeCode = escapeHtml(code);
  await sendEmail({
    to: email,
    subject: 'Verify your El Padel account',
    text: `Your El Padel verification code is ${code}. It expires in 30 minutes.`,
    html: emailLayout(
      'Verify your account',
      `<p>Your verification code is:</p>
       <p style="font-size:32px;letter-spacing:.22em;font-weight:700;color:#e0c477">${safeCode}</p>
       <p>This code expires in 30 minutes.</p>`,
    ),
  });
}

export async function sendTeammateAddedEmail(
  teammate: User,
  owner: User,
  event: Event,
) {
  const ownerLabel = displayName(owner);
  const title = escapeHtml(event.title);
  await sendEmail({
    to: teammate.email,
    subject: 'You were added as a teammate',
    text: `${owner.name ?? owner.email} added you as a teammate for ${event.title}.`,
    html: emailLayout(
      'You were added as a teammate',
      `<p>${ownerLabel} added you as a teammate for <strong>${title}</strong>.</p>
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
  const ownerLabel = displayName(owner);
  const title = escapeHtml(event.title);
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: email,
    subject: 'Your teammate registered you for El Padel',
    text: `${owner.name ?? owner.email} registered you for ${event.title}. Create your password: ${inviteUrl}`,
    html: emailLayout(
      'Your teammate registered you',
      `<p>${ownerLabel} registered you for <strong>${title}</strong>.</p>
       <p>Create your password and finish your profile to access the dashboard.</p>
       <p><a href="${inviteUrl}" style="color:#f2e3ad">Create password</a></p>`,
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
  const title = escapeHtml(event.title);
  const safeReason = reason ? escapeHtml(reason) : '';

  await Promise.all(
    recipients.map((user) =>
      sendEmail({
        to: user.email,
        subject: `Registration ${statusLabel}: ${event.title}`,
        text: `Your registration for ${event.title} was ${statusLabel}.${reason ? ` Reason: ${reason}` : ''}`,
        html: emailLayout(
          `Registration ${statusLabel}`,
          `<p>Your registration for <strong>${title}</strong> was ${statusLabel}.</p>
           ${safeReason ? `<p>Reason: ${safeReason}</p>` : ''}
           <p><a href="${appUrl('/dashboard')}" style="color:#f2e3ad">Open dashboard</a></p>`,
        ),
      }),
    ),
  );
}

export async function sendAccountInviteEmail(
  email: string,
  token: string,
  role: 'USER' | 'ADMIN',
) {
  const roleLabel = role === 'ADMIN' ? 'admin' : 'player';
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: email,
    subject: `Your El Padel ${roleLabel} account`,
    text: `An administrator created a ${roleLabel} account for you. Finish setup: ${inviteUrl}`,
    html: emailLayout(
      `Your ${roleLabel} account`,
      `<p>An administrator created a <strong>${roleLabel}</strong> account for you on El Padel.</p>
       <p>Create your password to finish setup and sign in.</p>
       <p><a href="${inviteUrl}" style="color:#f2e3ad">Create password</a></p>`,
    ),
  });
}

export async function sendClubMateInviteEmail(
  email: string,
  inviterName: string,
  clubName: string,
  token: string,
) {
  const safeInviter = escapeHtml(inviterName);
  const safeClub = escapeHtml(clubName);
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: email,
    subject: `Join ${clubName} on El Padel`,
    text: `${inviterName} added you to ${clubName}. Create your password: ${inviteUrl}`,
    html: emailLayout(
      'You were added to a club',
      `<p>${safeInviter} added you to <strong>${safeClub}</strong> on El Padel.</p>
       <p>Create your password to finish setup and open the dashboard.</p>
       <p><a href="${inviteUrl}" style="color:#f2e3ad">Create password</a></p>`,
    ),
  });
}
