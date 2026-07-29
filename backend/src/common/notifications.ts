import { type Event, type User } from '../generated/prisma/client.js';
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

export async function sendAccountInviteEmail(
  email: string,
  token: string,
  role: 'USER' | 'ADMIN' | 'JUDGE' | 'ORGANISER',
) {
  const roleLabel =
    role === 'ADMIN' ? 'admin'
      : role === 'JUDGE' ? 'judge'
        : role === 'ORGANISER' ? 'organiser'
          : 'player';
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

/**
 * Send a courtesy email for work that has already committed. A provider outage
 * must not turn a completed approval or hand-off into a 5xx the caller would
 * retry — the change is done, so the failure is logged and reported instead.
 */
export async function notifyAfterCommit(label: string, send: () => Promise<void>) {
  try {
    await send();
    return true;
  } catch (error) {
    console.error('[notify]', label, error instanceof Error ? error.message : error);
    return false;
  }
}

/** Render admin-written plain text as HTML paragraphs, escaping every line. */
function textToHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export async function sendClubApplicationReceivedEmail(
  email: string,
  clubName: string,
  mateEmail?: string | null,
) {
  const statusUrl = appUrl('/register/status');
  const details = [{ label: 'Club', value: clubName }];
  if (mateEmail) details.push({ label: 'Group mate', value: mateEmail });

  await sendEmail({
    to: email,
    subject: 'We received your El Padel club request',
    text: `Your request is with our team\n\nWe received your request to create ${clubName} on El Padel. An administrator will review it and email you the decision.\n\nCheck the status: ${statusUrl}`,
    html: emailLayout(
      'Your request is with our team',
      `<p style="margin:0">Thank you for applying. An administrator will review your club request and email you as soon as a decision is made.</p>
       ${emailDetails(details)}
       <p style="margin:0">You do not need to do anything else for now. We will be in touch.</p>
       ${emailButton('Check request status', statusUrl)}`,
      { eyebrow: 'Club request', preheader: `We received your request to create ${clubName}.` },
    ),
  });
}

export async function sendClubApplicationApprovedEmail(email: string, clubName: string) {
  const loginUrl = appUrl('/login');
  await sendEmail({
    to: email,
    subject: `${clubName} is approved — your El Padel account is ready`,
    text: `Your club request was approved\n\n${clubName} is live on El Padel and your account is ready. Sign in with the email and password you chose: ${loginUrl}`,
    html: emailLayout(
      'Your club request was approved',
      `<p style="margin:0">An administrator approved your request. Your account is active and your club is live.</p>
       ${emailDetails([{ label: 'Club', value: clubName }])}
       <p style="margin:0">Sign in with the email address and password you chose when you applied.</p>
       ${emailButton('Sign in to El Padel', loginUrl)}`,
      { eyebrow: 'Club request', preheader: `${clubName} is approved and your account is ready.` },
    ),
  });
}

export async function sendClubApplicationRejectedEmail(email: string, reason: string) {
  const registerUrl = appUrl('/register');
  const trimmedReason = reason.trim();
  const reasonBlock = trimmedReason
    ? emailPanel(`<p style="margin:0 0 6px;color:#766e67;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Reason</p><p style="margin:0;color:#211d1a;font-size:15px;line-height:24px">${escapeHtml(trimmedReason)}</p>`)
    : '';

  await sendEmail({
    to: email,
    subject: 'About your El Padel club request',
    text: `Your club request was not approved\n\n${trimmedReason ? `Reason: ${trimmedReason}\n\n` : ''}We have removed the details you submitted. You are welcome to apply again with this same email address: ${registerUrl}`,
    html: emailLayout(
      'Your club request was not approved',
      `<p style="margin:0">An administrator reviewed your request and was not able to approve it this time.</p>
       ${reasonBlock}
       <p style="margin:0">We have removed the details you submitted. You are welcome to apply again with this same email address.</p>
       ${emailButton('Apply again', registerUrl)}`,
      { eyebrow: 'Club request', preheader: 'An update on your El Padel club request.' },
    ),
  });
}

/** A free-text message an admin wrote to an applicant. */
export async function sendClubApplicationMessageEmail(
  email: string,
  subject: string,
  body: string,
) {
  const statusUrl = appUrl('/register/status');
  await sendEmail({
    to: email,
    subject,
    text: `${body}\n\nCheck your request status: ${statusUrl}`,
    html: emailLayout(
      subject,
      `${textToHtml(body)}
       ${emailButton('Check request status', statusUrl)}
       <p style="margin:18px 0 0;color:#766e67;font-size:13px;line-height:21px">This message was sent by an El Padel administrator about your club request. Reply to this email to reach them.</p>`,
      { eyebrow: 'Club request', preheader: 'A message about your El Padel club request.' },
    ),
  });
}

export async function sendEventOrganiserAssignedEmail(
  email: string,
  eventTitle: string,
  eventId: string,
) {
  const eventUrl = appUrl(`/admin/events/${eventId}`);
  await sendEmail({
    to: email,
    subject: `You are running ${eventTitle}`,
    text: `You were assigned as organiser\n\nAn administrator handed ${eventTitle} to you. You can now manage its bracket, schedule, judges and opponent requests: ${eventUrl}`,
    html: emailLayout(
      'You were assigned as organiser',
      `<p style="margin:0">An administrator handed this tournament to you.</p>
       ${emailDetails([{ label: 'Tournament', value: eventTitle }])}
       <p style="margin:0">You can now manage its bracket, schedule, judges, opponent requests and lifecycle.</p>
       ${emailButton('Open the event', eventUrl)}`,
      { eyebrow: 'Organiser assignment', preheader: `You were assigned to run ${eventTitle}.` },
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
