'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LogOut,
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
} from '@/components/shared/dashboard/DashboardUI';
import { Field } from '@/components/shared/dashboard/DashboardForm';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { apiFetch, readApiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { AccountIdentityCard, AccountProfileForm, useOwnAccount } from './AccountProfile';
import {
  emptyPasswordForm,
  hasErrors,
  passwordRules,
  validatePassword,
} from './accountModel';

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

type SectionKey = 'profile' | 'security' | 'preferences' | 'danger';

/** Password field with a reveal toggle sized for touch. */
function SecretInput({
  id,
  label,
  value,
  autoComplete,
  onChange,
  hint,
  error,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(control) => (
      <div className="relative">
        <Input
          {...control}
          type={revealed ? 'text' : 'password'}
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
      )}
    </Field>
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
 * The account workspace — identity, security, preferences, and irreversible
 * actions — shared by every signed-in role. The server decides what each field
 * may become; this only decides how it reads.
 *
 * The profile pane is optional because a workspace may give the profile a page
 * of its own instead, as the player dashboard does. When it is dropped, the
 * `#profile` deep link no longer resolves and settings opens on Security.
 */
export function AccountSettings({
  user,
  danger,
  includeProfile = true,
}: {
  user: PublicUser;
  danger: AccountDangerCopy;
  includeProfile?: boolean;
}) {
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const copy = dictionary.dashboard.account;

  const { account: ownAccount, error: ownAccountError, setAccount: setOwnAccount } = useOwnAccount();
  const hasPassword = ownAccount?.hasPassword ?? true;

  const [section, setSection] = useState<SectionKey>(includeProfile ? 'profile' : 'security');

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordTried, setPasswordTried] = useState(false);
  const [signOutAllBusy, setSignOutAllBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const sections: { key: SectionKey; label: string; icon: LucideIcon }[] = [
    ...(includeProfile ? [{ key: 'profile' as const, label: copy.sectionProfile, icon: UserRound }] : []),
    { key: 'security', label: copy.sectionSecurity, icon: ShieldCheck },
    { key: 'preferences', label: tournamentCopy[locale].account.sectionPreferences, icon: Languages },
    { key: 'danger', label: copy.sectionDanger, icon: TriangleAlert },
  ];

  // The header profile menu deep-links to a section, so the hash drives the
  // open pane even when the page itself does not remount. A hash naming a pane
  // this workspace does not show is ignored rather than opening an empty one.
  useEffect(() => {
    const applyHash = () => {
      const key = window.location.hash.slice(1);
      const known = sections.find((item) => item.key === key);
      if (known) setSection(known.key);
    };
    const timer = window.setTimeout(applyHash, 0);
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', applyHash);
    };
    // The pane list is stable for the life of the screen; only its wording
    // changes with the locale, and that must not reopen a pane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeProfile]);

  function selectSection(key: SectionKey) {
    setSection(key);
    window.history.replaceState(null, '', `#${key}`);
  }

  const account = tournamentCopy[locale].account;
  const passwordErrors = validatePassword(passwordForm, hasPassword);
  const { lengthMet, matchMet } = passwordRules(passwordForm);
  const passwordErrorFor = (field: keyof typeof passwordForm) => {
    const code = passwordTried ? passwordErrors[field] : undefined;
    return code ? account.errors[code] : undefined;
  };

  /**
   * Revoke every session, this one included, and land on the login page. The
   * server bumps sessionVersion, so any other browser is signed out at once
   * rather than at its next refresh.
   */
  async function signOutEverywhere() {
    setSignOutAllBusy(true);
    try {
      await apiFetch('/api/auth/logout-all', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    setPasswordTried(true);
    if (hasErrors(passwordErrors)) return;
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
    setOwnAccount((current) => (current ? { ...current, hasPassword: true } : current));
    setPasswordSaved(true);
    setPasswordTried(false);
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

  return (
    <>
      <AccountIdentityCard user={user} />

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
              <div className="mt-4">
                <AccountProfileForm user={user} account={ownAccount} loadError={ownAccountError} />
              </div>
            </section>
          ) : null}

          {section === 'security' ? (
            <section aria-labelledby="account-security-heading">
              <SectionHeading
                id="account-security-heading"
                title={copy.passwordTitle}
                description={hasPassword ? copy.passwordDescription : copy.setPasswordDescription}
              />

              {/* The sign-in method below is read from the account record. Say
                  so when it could not be read, rather than letting the default
                  pass for fact. */}
              {ownAccountError ? (
                <div className="mt-4">
                  <FeedbackBanner kind="error">{ownAccountError}</FeedbackBanner>
                </div>
              ) : null}

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
                        error={passwordErrorFor('currentPassword')}
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
                        error={passwordErrorFor('newPassword')}
                        showLabel={copy.showPassword}
                        hideLabel={copy.hidePassword}
                      />
                      <SecretInput
                        id="account-confirm-password"
                        label={copy.confirmPassword}
                        value={passwordForm.confirmPassword}
                        autoComplete="new-password"
                        onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
                        error={passwordErrorFor('confirmPassword')}
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
                      disabled={passwordBusy}
                      className="min-h-11 rounded-md px-4 sm:shrink-0"
                    >
                      {passwordBusy ? copy.saving : hasPassword ? copy.changePassword : copy.setPassword}
                    </Button>
                  </div>
                </form>
              </SurfaceCard>

              {/* Signing out on this device no longer signs the account out
                  everywhere, so the account-wide version needs its own control —
                  it is what you reach for when a device is lost. */}
              <SurfaceCard className="mt-4">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
                      <LogOut className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--dash-ink)]">{copy.signOutEverywhereTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--dash-muted)]">{copy.signOutEverywhereDescription}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={signOutAllBusy}
                    onClick={signOutEverywhere}
                    className="min-h-11 rounded-md px-4 sm:shrink-0"
                  >
                    {signOutAllBusy ? copy.signingOutEverywhere : copy.signOutEverywhere}
                  </Button>
                </div>
              </SurfaceCard>
            </section>
          ) : null}

          {section === 'preferences' ? (
            <section aria-labelledby="account-preferences-heading">
              <SectionHeading
                id="account-preferences-heading"
                title={account.preferencesTitle}
                description={account.preferencesDescription}
              />
              <SurfaceCard className="mt-4">
                <div className="grid gap-3 p-5">
                  <h3 className="text-sm font-semibold text-[var(--dash-text)]">{account.language}</h3>
                  <LanguageSwitcher tone="light" />
                  {/* No save button: the switch applies at once, and pretending
                      otherwise would be the silent-autosave the form rules forbid. */}
                  <p className="text-sm leading-5 text-[var(--dash-muted)]">{account.languageNote}</p>
                </div>
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
