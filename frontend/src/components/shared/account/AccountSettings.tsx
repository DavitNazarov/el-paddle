'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Building2,
  Check,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  DashboardModal,
  FeedbackBanner,
  InfoChip,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
  selectControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { apiFetch, readApiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PublicUser, UserRole } from '@/types/auth';

/**
 * Role-specific wording for the irreversible actions. Each workspace keeps its
 * own copy (a player loses club entries, an admin cannot be the last one), so
 * the panel takes it as data instead of guessing from the role.
 */
export type AccountDangerCopy = {
  dangerTitle: string;
  dangerDescription: string;
  deleteTitle: string;
  deleteButton: string;
  deleteWarning: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmDelete: string;
  deleting: string;
  deleteFailed: string;
};

type AccountProfile = {
  email: string;
  name: string;
  surname: string;
  phone: string;
  hasPassword: boolean;
};

type ProfileForm = Pick<AccountProfile, 'name' | 'surname' | 'phone'>;

const SECTION_KEYS = ['profile', 'security', 'danger'] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
const MIN_PASSWORD_LENGTH = 12;

function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

function initialsOf(user: PublicUser) {
  const letters = [user.name, user.surname]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join('');
  return (letters || user.email.charAt(0)).toUpperCase();
}

function sameProfile(a: ProfileForm, b: ProfileForm) {
  return a.name === b.name && a.surname === b.surname && a.phone === b.phone;
}

/** Password field with a reveal toggle sized for touch. */
function SecretInput({
  id,
  label,
  value,
  autoComplete,
  onChange,
  hint,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
  hint?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;

  return (
    <DashboardField id={id} label={label} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          type={revealed ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(formControlClassName, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? hideLabel : showLabel}
          aria-pressed={revealed}
          className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-md text-[var(--dash-faint)] transition-colors hover:text-[var(--dash-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
    </DashboardField>
  );
}

/** One password rule, stated in words and echoed by an icon. */
function PasswordRule({ met, label, metLabel, unmetLabel }: { met: boolean; label: string; metLabel: string; unmetLabel: string }) {
  const Icon = met ? Check : Circle;
  return (
    <li className="flex items-center gap-2 text-xs leading-5">
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', met ? 'text-[var(--dash-teal)]' : 'text-[var(--dash-faint)]')}
        aria-hidden
      />
      <span className={met ? 'text-[var(--dash-teal)]' : 'text-[var(--dash-muted)]'}>{label}</span>
      <span className="sr-only">{met ? metLabel : unmetLabel}</span>
    </li>
  );
}

/**
 * The whole account workspace — identity, profile, security, and irreversible
 * actions — shared by every signed-in role. The server decides what each field
 * may become; this only decides how it reads.
 */
export function AccountSettings({ user, danger }: { user: PublicUser; danger: AccountDangerCopy }) {
  const router = useRouter();
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.account;

  const [section, setSection] = useState<SectionKey>('profile');

  const [saved, setSaved] = useState<ProfileForm>({ name: user.name, surname: user.surname, phone: user.phone });
  const [profile, setProfile] = useState<ProfileForm>(saved);
  const [hasPassword, setHasPassword] = useState(true);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    const response = await apiFetch('/api/account/profile', { cache: 'no-store' });
    const data = await readApiJson<{ profile?: AccountProfile }>(response, {});
    if (!response.ok || !data.profile) {
      setProfileError(copy.loadFailed);
      return;
    }
    const next = { name: data.profile.name, surname: data.profile.surname, phone: data.profile.phone };
    setSaved(next);
    setProfile(next);
    setHasPassword(data.profile.hasPassword);
  }, [copy.loadFailed]);

  // The header profile menu deep-links to a section, so the hash drives the
  // open pane even when the page itself does not remount.
  useEffect(() => {
    const applyHash = () => {
      const key = window.location.hash.slice(1);
      if (isSectionKey(key)) setSection(key);
    };
    const timer = window.setTimeout(() => {
      applyHash();
      void load();
    }, 0);
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', applyHash);
    };
  }, [load]);

  function selectSection(key: SectionKey) {
    setSection(key);
    window.history.replaceState(null, '', `#${key}`);
  }

  const dirty = !sameProfile(profile, saved);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    setProfileBusy(true);
    const response = await apiFetch('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
    const data = await readApiJson<{ error?: string }>(response, {});
    setProfileBusy(false);
    if (!response.ok) {
      setProfileError(data.error ?? copy.profileFailed);
      return;
    }
    setSaved(profile);
    setProfileSaved(true);
    // The shell header and sidebar render the name from the server session.
    router.refresh();
  }

  const lengthMet = passwordForm.newPassword.length >= MIN_PASSWORD_LENGTH;
  const matchMet = passwordForm.newPassword.length > 0 && passwordForm.newPassword === passwordForm.confirmPassword;

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    if (!matchMet) {
      setPasswordError(copy.passwordMismatch);
      return;
    }
    setPasswordBusy(true);
    const response = await apiFetch('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    const data = await readApiJson<{ error?: string }>(response, {});
    setPasswordBusy(false);
    if (!response.ok) {
      setPasswordError(data.error ?? copy.passwordFailed);
      return;
    }
    setPasswordForm(emptyPasswordForm);
    setHasPassword(true);
    setPasswordSaved(true);
  }

  async function deleteAccount() {
    setDeleteError('');
    setDeleteBusy(true);
    const response = await apiFetch('/api/account', { method: 'DELETE' });
    const data = await readApiJson<{ error?: string }>(response, {});
    setDeleteBusy(false);
    if (!response.ok) {
      setConfirmOpen(false);
      setDeleteError(data.error ?? danger.deleteFailed);
      return;
    }
    router.push('/login');
    router.refresh();
  }

  const roleLabels: Record<UserRole, string> = {
    USER: copy.rolePlayer,
    JUDGE: copy.roleJudge,
    ORGANISER: copy.roleOrganiser,
    ADMIN: copy.roleAdmin,
  };

  const sections: { key: SectionKey; label: string; icon: LucideIcon }[] = [
    { key: 'profile', label: copy.sectionProfile, icon: UserRound },
    { key: 'security', label: copy.sectionSecurity, icon: ShieldCheck },
    { key: 'danger', label: copy.sectionDanger, icon: TriangleAlert },
  ];

  return (
    <>
      <SurfaceCard>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[rgba(164,22,26,0.2)] bg-[var(--dash-primary-soft)] font-display text-lg font-semibold text-[var(--dash-primary)]"
          >
            {initialsOf(user)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-normal text-[var(--dash-text)]">{user.fullName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--dash-muted)]">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--dash-faint)]" aria-hidden />
                <span className="truncate">{user.email}</span>
              </span>
              {user.club ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--dash-faint)]" aria-hidden />
                  <span className="truncate">{user.club.name}</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InfoChip icon={UserRound}>{roleLabels[user.role]}</InfoChip>
            <InfoChip
              icon={user.isVerified ? BadgeCheck : ShieldAlert}
              tone={user.isVerified ? 'positive' : 'warning'}
            >
              {user.isVerified ? copy.verified : copy.unverified}
            </InfoChip>
          </div>
        </div>
      </SurfaceCard>

      <div className="mt-6 grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <div className="lg:hidden">
          <DashboardField id="account-section" label={copy.sectionsLabel}>
            <select
              id="account-section"
              className={selectControlClassName}
              value={section}
              onChange={(event) => selectSection(event.target.value as SectionKey)}
            >
              {sections.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </DashboardField>
        </div>

        <nav aria-label={copy.sectionsLabel} className="hidden lg:block lg:self-start lg:sticky lg:top-28">
          <div className="grid gap-0.5">
            {sections.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => selectSection(item.key)}
                data-active={section === item.key}
                aria-current={section === item.key ? 'true' : undefined}
                className="dash-sidebar-link"
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="dash-sidebar-label truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {section === 'profile' ? (
            <section aria-labelledby="account-profile-heading">
              <SectionHeading
                id="account-profile-heading"
                title={copy.profileTitle}
                description={copy.profileDescription}
              />
              <SurfaceCard className="mt-4 overflow-hidden">
                <form onSubmit={saveProfile}>
                  <div className="grid gap-4 p-5">
                    {profileError ? <FeedbackBanner kind="error">{profileError}</FeedbackBanner> : null}
                    {profileSaved && !dirty ? (
                      <FeedbackBanner kind="success">{copy.profileSaved}</FeedbackBanner>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <DashboardField id="account-name" label={copy.name}>
                        <Input
                          id="account-name"
                          required
                          autoComplete="given-name"
                          value={profile.name}
                          onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                          className={formControlClassName}
                        />
                      </DashboardField>
                      <DashboardField id="account-surname" label={copy.surname}>
                        <Input
                          id="account-surname"
                          required
                          autoComplete="family-name"
                          value={profile.surname}
                          onChange={(event) => setProfile((current) => ({ ...current, surname: event.target.value }))}
                          className={formControlClassName}
                        />
                      </DashboardField>
                    </div>

                    <DashboardField id="account-phone" label={copy.phone} hint={copy.phoneHint}>
                      <Input
                        id="account-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required={user.role === 'USER'}
                        value={profile.phone}
                        onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                        className={formControlClassName}
                      />
                    </DashboardField>

                    <DashboardField id="account-email" label={copy.email} hint={copy.emailHint}>
                      <Input
                        id="account-email"
                        type="email"
                        value={user.email}
                        readOnly
                        disabled
                        className={cn(formControlClassName, 'bg-[var(--dash-tint)] text-[var(--dash-muted)]')}
                      />
                    </DashboardField>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-tint)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[var(--dash-muted)]" role="status">
                      {dirty ? copy.unsavedChanges : copy.allSaved}
                    </p>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!dirty || profileBusy}
                        onClick={() => setProfile(saved)}
                        className={cn(softButtonClassName, 'min-h-11 rounded-md px-4')}
                      >
                        {copy.discard}
                      </Button>
                      <Button type="submit" disabled={!dirty || profileBusy} className="min-h-11 rounded-md px-4">
                        {profileBusy ? copy.saving : copy.save}
                      </Button>
                    </div>
                  </div>
                </form>
              </SurfaceCard>
            </section>
          ) : null}

          {section === 'security' ? (
            <section aria-labelledby="account-security-heading">
              <SectionHeading
                id="account-security-heading"
                title={copy.passwordTitle}
                description={hasPassword ? copy.passwordDescription : copy.setPasswordDescription}
              />

              <SurfaceCard className="mt-4">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
                      <KeyRound className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--dash-text)]">{copy.signInTitle}</h3>
                      <p className="mt-1 text-sm leading-5 text-[var(--dash-muted)]">
                        {hasPassword ? copy.signInPassword : copy.signInGoogle}
                      </p>
                    </div>
                  </div>
                  <InfoChip
                    icon={hasPassword ? ShieldCheck : ShieldAlert}
                    tone={hasPassword ? 'positive' : 'warning'}
                  >
                    {hasPassword ? copy.passwordEnabled : copy.passwordNotSet}
                  </InfoChip>
                </div>
              </SurfaceCard>

              <SurfaceCard className="mt-4 overflow-hidden">
                <form onSubmit={savePassword}>
                  <div className="grid gap-4 p-5">
                    {passwordError ? <FeedbackBanner kind="error">{passwordError}</FeedbackBanner> : null}
                    {passwordSaved ? <FeedbackBanner kind="success">{copy.passwordSaved}</FeedbackBanner> : null}

                    {hasPassword ? (
                      <SecretInput
                        id="account-current-password"
                        label={copy.currentPassword}
                        value={passwordForm.currentPassword}
                        autoComplete="current-password"
                        onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
                        showLabel={copy.showPassword}
                        hideLabel={copy.hidePassword}
                      />
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SecretInput
                        id="account-new-password"
                        label={copy.newPassword}
                        value={passwordForm.newPassword}
                        autoComplete="new-password"
                        onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
                        showLabel={copy.showPassword}
                        hideLabel={copy.hidePassword}
                      />
                      <SecretInput
                        id="account-confirm-password"
                        label={copy.confirmPassword}
                        value={passwordForm.confirmPassword}
                        autoComplete="new-password"
                        onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
                        showLabel={copy.showPassword}
                        hideLabel={copy.hidePassword}
                      />
                    </div>

                    <ul className="grid gap-1.5 rounded-md border border-[var(--dash-border)] bg-[var(--dash-tint)] px-3 py-2.5">
                      <PasswordRule
                        met={lengthMet}
                        label={copy.ruleLength}
                        metLabel={copy.ruleMet}
                        unmetLabel={copy.ruleUnmet}
                      />
                      <PasswordRule
                        met={matchMet}
                        label={copy.ruleMatch}
                        metLabel={copy.ruleMet}
                        unmetLabel={copy.ruleUnmet}
                      />
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-tint)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.passwordSessionsNote}</p>
                    <Button
                      type="submit"
                      disabled={passwordBusy || !lengthMet || !matchMet}
                      className="min-h-11 rounded-md px-4 sm:shrink-0"
                    >
                      {passwordBusy ? copy.saving : hasPassword ? copy.changePassword : copy.setPassword}
                    </Button>
                  </div>
                </form>
              </SurfaceCard>
            </section>
          ) : null}

          {section === 'danger' ? (
            <section aria-labelledby="account-danger-heading">
              <SectionHeading
                id="account-danger-heading"
                title={danger.dangerTitle}
                description={danger.dangerDescription}
              />
              {deleteError ? (
                <div className="mt-4">
                  <FeedbackBanner kind="error">{deleteError}</FeedbackBanner>
                </div>
              ) : null}
              <SurfaceCard className="mt-4 border-[rgba(194,65,59,0.28)]">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[rgba(194,65,59,0.28)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]">
                      <TriangleAlert className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--dash-text)]">{danger.deleteTitle}</h3>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--dash-muted)]">
                        {danger.deleteWarning}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmOpen(true)}
                    className="min-h-11 shrink-0 gap-2 rounded-md border-[rgba(194,65,59,0.35)] bg-transparent px-4 text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)] hover:text-[var(--dash-coral)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {danger.deleteButton}
                  </Button>
                </div>
              </SurfaceCard>
            </section>
          ) : null}
        </div>
      </div>

      <DashboardModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={danger.confirmTitle}
        description={danger.confirmDescription}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setConfirmOpen(false)}
            cancelLabel={dictionary.common.cancel}
            busy={deleteBusy}
            submitType="button"
            onSubmitClick={() => {
              void deleteAccount();
            }}
            submitLabel={deleteBusy ? danger.deleting : danger.confirmDelete}
          />
        }
      >
        <p className="text-sm leading-6 text-[#6d5f5c]">{danger.deleteWarning}</p>
      </DashboardModal>
    </>
  );
}
