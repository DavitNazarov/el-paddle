import { RegistrationStatus, type Event, type User } from '../generated/prisma/client.js';
import { appUrl, emailButton, emailDetails, emailLayout, emailPanel, escapeHtml, sendEmail } from './email.js';

function userDisplayName(user: Pick<User, 'name' | 'surname' | 'email'>) {
  return [user.name?.trim(), user.surname?.trim()].filter(Boolean).join(' ') || user.email;
}

function displayName(user: Pick<User, 'name' | 'surname' | 'email'>) {
  return escapeHtml(userDisplayName(user));
}

export async function sendVerificationCodeEmail(email: string, code: string) {
  const safeCode = escapeHtml(code);
  await sendEmail({
    to: email,
    subject: 'Your El Padel verification code',
    text: `Confirm your email address\n\nYour verification code is: ${code}\n\nThis code expires in 30 minutes. If you did not request it, you can ignore this email.`,
    html: emailLayout(
      'Confirm your email address',
      `<p style="margin:0 0 16px">Enter this code to confirm your email address and finish creating your El Padel account.</p>
       ${emailPanel(`<p style="margin:0 0 6px;color:#766e67;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Verification code</p><p style="margin:0;color:#211d1a;font-size:32px;font-weight:700;letter-spacing:.2em;line-height:40px">${safeCode}</p>`)}
       <p style="margin:16px 0 0;color:#766e67;font-size:14px;line-height:22px">This code expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>`,
      { eyebrow: 'Account verification', preheader: `Your verification code is ${code}. It expires in 30 minutes.` },
    ),
  });
}

export async function sendTeammateAddedEmail(
  teammate: User,
  owner: User,
  event: Event,
) {
  const ownerLabel = displayName(owner);
  const ownerName = userDisplayName(owner);
  const dashboardUrl = appUrl('/dashboard');
  await sendEmail({
    to: teammate.email,
    subject: `${event.title}: you were added as a teammate`,
    text: `You were added to a team\n\n${ownerName} added you as their teammate for ${event.title}.\n\nView the registration: ${dashboardUrl}`,
    html: emailLayout(
      'You were added to a team',
      `<p style="margin:0">${ownerLabel} added you as their teammate in an El Padel tournament.</p>
       ${emailDetails([{ label: 'Tournament', value: event.title }, { label: 'Teammate', value: ownerName }])}
       <p style="margin:0">Review the team entry and track its approval status in your dashboard.</p>
       ${emailButton('View registration', dashboardUrl)}`,
      { eyebrow: 'Tournament registration', preheader: `${ownerName} added you as a teammate for ${event.title}.` },
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
  const ownerName = userDisplayName(owner);
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  const privacyUrl = appUrl('/legal/privacy');
  await sendEmail({
    to: email,
    subject: `Complete your registration for ${event.title}`,
    text: `Complete your El Padel account\n\n${ownerName} provided your email address and registered you as their teammate for ${event.title}. We use it to manage this invitation and tournament entry.\n\nCreate your password and complete your profile: ${inviteUrl}\n\nPrivacy Policy: ${privacyUrl}`,
    html: emailLayout(
      'Complete your El Padel account',
      `<p style="margin:0">${ownerLabel} registered you as their teammate in an El Padel tournament.</p>
       ${emailDetails([{ label: 'Tournament', value: event.title }, { label: 'Invited by', value: ownerName }])}
       <p style="margin:0">Create your password and complete your player profile to join the team entry.</p>
       ${emailButton('Complete account setup', inviteUrl)}
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">${ownerLabel} provided your email address for this invitation. See how we use your data in our <a href="${privacyUrl}" style="color:#86000c;font-weight:700">Privacy Policy</a>.</p>
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">If you were not expecting this invitation, you can ignore this email.</p>`,
      { eyebrow: 'Teammate invitation', preheader: `${ownerName} registered you for ${event.title}.` },
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
  const heading = status === RegistrationStatus.APPROVED
    ? 'Your registration is approved'
    : status === RegistrationStatus.DECLINED
      ? 'Registration update'
      : 'Your registration is pending review';
  const safeReason = reason ? escapeHtml(reason) : '';
  const dashboardUrl = appUrl('/dashboard');

  await Promise.all(
    recipients.map((user) =>
      sendEmail({
        to: user.email,
        subject: `${event.title}: registration ${statusLabel}`,
        text: `${heading}\n\nYour registration for ${event.title} was ${statusLabel}.${reason ? `\n\nNote from the organizer: ${reason}` : ''}\n\nView registration: ${dashboardUrl}`,
        html: emailLayout(
          heading,
          `<p style="margin:0">The organizer has updated your tournament registration.</p>
           ${emailDetails([{ label: 'Tournament', value: event.title }, { label: 'Status', value: statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1) }])}
           ${safeReason ? emailPanel(`<p style="margin:0 0 6px;color:#766e67;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Note from the organizer</p><p style="margin:0;color:#4f4842">${safeReason}</p>`) : ''}
           ${emailButton('View registration', dashboardUrl)}`,
          { eyebrow: 'Registration status', preheader: `Your registration for ${event.title} was ${statusLabel}.` },
        ),
      }),
    ),
  );
}

export async function sendAccountInviteEmail(
  email: string,
  token: string,
  role: 'USER' | 'ADMIN' | 'JUDGE',
) {
  const roleLabel = role === 'ADMIN' ? 'admin' : role === 'JUDGE' ? 'judge' : 'player';
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  const privacyUrl = appUrl('/legal/privacy');
  await sendEmail({
    to: email,
    subject: `Set up your El Padel ${roleLabel} account`,
    text: `Welcome to El Padel\n\nAn El Padel administrator provided your email address to create a ${roleLabel} account. Set your password to finish setup: ${inviteUrl}\n\nPrivacy Policy: ${privacyUrl}`,
    html: emailLayout(
      'Welcome to El Padel',
      `<p style="margin:0">Your El Padel account has been created and is ready for you to activate.</p>
       ${emailDetails([{ label: 'Account type', value: roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1) }])}
       <p style="margin:0">Create a secure password to finish setup and sign in.</p>
       ${emailButton('Set up my account', inviteUrl)}
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">An El Padel administrator provided your email for this invitation. Read our <a href="${privacyUrl}" style="color:#86000c;font-weight:700">Privacy Policy</a>.</p>
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">If you were not expecting this invitation, you can ignore this email.</p>`,
      { eyebrow: 'Account invitation', preheader: `Your El Padel ${roleLabel} account is ready to set up.` },
    ),
  });
}

export async function sendClubMateInviteEmail(
  email: string,
  inviterName: string,
  clubName: string,
  token: string,
) {
  const inviteUrl = appUrl(`/invite?token=${encodeURIComponent(token)}`);
  const privacyUrl = appUrl('/legal/privacy');
  await sendEmail({
    to: email,
    subject: `You’re invited to join ${clubName} on El Padel`,
    text: `Join ${clubName} on El Padel\n\n${inviterName} provided your email address and invited you to join ${clubName}. Set your password to accept the invitation: ${inviteUrl}\n\nPrivacy Policy: ${privacyUrl}`,
    html: emailLayout(
      `Join ${clubName} on El Padel`,
      `<p style="margin:0">You have been invited to join a club on El Padel.</p>
       ${emailDetails([{ label: 'Club', value: clubName }, { label: 'Invited by', value: inviterName }])}
       <p style="margin:0">Create your password to accept the invitation and access the club dashboard.</p>
       ${emailButton('Accept invitation', inviteUrl)}
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">${escapeHtml(inviterName)} provided your email for this invitation. Read our <a href="${privacyUrl}" style="color:#86000c;font-weight:700">Privacy Policy</a>.</p>
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">If you were not expecting this invitation, you can ignore this email.</p>`,
      { eyebrow: 'Club invitation', preheader: `${inviterName} invited you to join ${clubName}.` },
    ),
  });
}
