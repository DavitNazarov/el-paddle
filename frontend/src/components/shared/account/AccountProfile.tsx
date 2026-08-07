'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Building2, Mail, ShieldAlert, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DashboardField,
  FeedbackBanner,
  InfoChip,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Field } from '@/components/shared/dashboard/DashboardForm';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { apiFetch, readApiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PublicUser, UserRole } from '@/types/auth';
import {
  hasErrors,
  initialsOf,
  sameProfile,
  validateProfile,
  type ProfileForm,
} from './accountModel';

/** What `/api/account/profile` returns about the signed-in reader. */
export type OwnAccount = {
  email: string;
  name: string;
  surname: string;
  phone: string;
  hasPassword: boolean;
};

/**
 * The reader's own account record, fetched once. Two screens need it — the
 * profile page for the editable fields, settings for the sign-in method — so
 * the request lives here rather than in either of them.
 */
export function useOwnAccount() {
  const { dictionary } = useI18n();
  const loadFailed = dictionary.dashboard.account.loadFailed;
  const [account, setAccount] = useState<OwnAccount | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void apiFetch('/api/account/profile', { cache: 'no-store' })
      .then(async (response) => {
        const data = await readApiJson<{ profile?: OwnAccount }>(response, {});
        if (cancelled) return;
        if (!response.ok || !data.profile) {
          setError(loadFailed);
          return;
        }
        setAccount(data.profile);
      })
      .catch(() => {
        if (!cancelled) setError(loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [loadFailed]);

  return { account, error, setAccount };
}

type RoleCopy = {
  rolePlayer: string;
  roleJudge: string;
  roleOrganiser: string;
  roleAdmin: string;
};

/** Role names the reader would recognise, keyed by the value the server sends. */
export function accountRoleLabels(copy: RoleCopy): Record<UserRole, string> {
  return {
    USER: copy.rolePlayer,
    JUDGE: copy.roleJudge,
    ORGANISER: copy.roleOrganiser,
    ADMIN: copy.roleAdmin,
  };
}

/**
 * Who the reader is, at a glance: initials, name, the two contact facts, and
 * the two chips that say what this account may do and whether it is verified.
 */
export function AccountIdentityCard({ user }: { user: PublicUser }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.account;

  return (
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
          <InfoChip icon={UserRound}>{accountRoleLabels(copy)[user.role]}</InfoChip>
          <InfoChip
            icon={user.isVerified ? BadgeCheck : ShieldAlert}
            tone={user.isVerified ? 'positive' : 'warning'}
          >
            {user.isVerified ? copy.verified : copy.unverified}
          </InfoChip>
        </div>
      </div>
    </SurfaceCard>
  );
}

export type ProfileEditor = {
  /** What is currently in the fields. */
  profile: ProfileForm;
  /** What the server last accepted — what a read-only view must show. */
  saved: ProfileForm;
  setField: (field: keyof ProfileForm, value: string) => void;
  dirty: boolean;
  busy: boolean;
  error: string;
  justSaved: boolean;
  errorFor: (field: keyof ProfileForm) => string | undefined;
  save: (event: React.FormEvent) => void;
  discard: () => void;
};

/**
 * State, validation, and the save for the three fields the reader owns. Two
 * screens edit them — settings in place, the player profile in a modal — so the
 * save path lives here rather than in either shell, and the two cannot drift.
 */
export function useProfileEditor({
  user,
  account,
  onSaved,
}: {
  user: PublicUser;
  /** Null while the record is still loading; the session values stand in. */
  account: OwnAccount | null;
  onSaved?: (profile: ProfileForm) => void;
}): ProfileEditor {
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const copy = dictionary.dashboard.account;
  const errorCopy = tournamentCopy[locale].account.errors;

  const [saved, setSaved] = useState<ProfileForm>({ name: user.name, surname: user.surname, phone: user.phone });
  const [profile, setProfile] = useState<ProfileForm>(saved);
  const [adopted, setAdopted] = useState<OwnAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [tried, setTried] = useState(false);

  // The session user is a good first paint, but the account record is the
  // truth — adopt it the moment it lands. Done during render rather than in an
  // effect so the fields never paint one frame of stale values.
  if (account && account !== adopted) {
    const next = { name: account.name, surname: account.surname, phone: account.phone };
    setAdopted(account);
    setSaved(next);
    setProfile(next);
  }

  const dirty = !sameProfile(profile, saved);
  const errors = validateProfile(profile, user.role === 'USER');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setJustSaved(false);
    setTried(true);
    if (hasErrors(errors)) return;
    setBusy(true);
    const response = await apiFetch('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
    const data = await readApiJson<{ error?: string }>(response, {});
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? copy.profileFailed);
      return;
    }
    setSaved(profile);
    setJustSaved(true);
    onSaved?.(profile);
    // The shell header and sidebar render the name from the server session.
    router.refresh();
  }

  return {
    profile,
    saved,
    setField: (field, value) => setProfile((current) => ({ ...current, [field]: value })),
    dirty,
    busy,
    error,
    justSaved,
    errorFor: (field) => {
      const code = tried ? errors[field] : undefined;
      return code ? errorCopy[code] : undefined;
    },
    save,
    discard: () => setProfile(saved),
  };
}

/**
 * The three fields the reader owns, with the address they sign in with shown
 * but locked. Carries no shell of its own, so the same controls serve the
 * settings card and the profile modal.
 */
export function AccountProfileFields({ editor, email }: { editor: ProfileEditor; email: string }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.account;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="account-name" label={copy.name} error={editor.errorFor('name')}>
          {(control) => (
            <Input
              {...control}
              autoComplete="given-name"
              value={editor.profile.name}
              onChange={(event) => editor.setField('name', event.target.value)}
              className={formControlClassName}
            />
          )}
        </Field>
        <Field id="account-surname" label={copy.surname} error={editor.errorFor('surname')}>
          {(control) => (
            <Input
              {...control}
              autoComplete="family-name"
              value={editor.profile.surname}
              onChange={(event) => editor.setField('surname', event.target.value)}
              className={formControlClassName}
            />
          )}
        </Field>
      </div>

      <Field id="account-phone" label={copy.phone} hint={copy.phoneHint} error={editor.errorFor('phone')}>
        {(control) => (
          <Input
            {...control}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={editor.profile.phone}
            onChange={(event) => editor.setField('phone', event.target.value)}
            className={formControlClassName}
          />
        )}
      </Field>

      <DashboardField id="account-email" label={copy.email} hint={copy.emailHint}>
        <Input
          id="account-email"
          type="email"
          value={email}
          readOnly
          disabled
          className={cn(formControlClassName, 'bg-[var(--dash-tint)] text-[var(--dash-muted)]')}
        />
      </DashboardField>
    </div>
  );
}

/**
 * The fields in an always-open card that saves only on request and says what is
 * unsaved until then. Used by account settings, where editing is the whole
 * point of the screen.
 */
export function AccountProfileForm({
  user,
  account,
  loadError,
}: {
  user: PublicUser;
  account: OwnAccount | null;
  loadError: string;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.account;
  const editor = useProfileEditor({ user, account });

  return (
    <SurfaceCard className="overflow-hidden">
      <form onSubmit={editor.save}>
        <div className="grid gap-4 p-5">
          {editor.error || loadError ? (
            <FeedbackBanner kind="error">{editor.error || loadError}</FeedbackBanner>
          ) : null}
          {editor.justSaved && !editor.dirty ? (
            <FeedbackBanner kind="success">{copy.profileSaved}</FeedbackBanner>
          ) : null}

          <AccountProfileFields editor={editor} email={user.email} />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-tint)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--dash-muted)]" role="status">
            {editor.dirty ? copy.unsavedChanges : copy.allSaved}
          </p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!editor.dirty || editor.busy}
              onClick={editor.discard}
              className={cn(softButtonClassName, 'min-h-11 rounded-md px-4')}
            >
              {copy.discard}
            </Button>
            <Button type="submit" disabled={editor.busy} className="min-h-11 rounded-md px-4">
              {editor.busy ? copy.saving : copy.save}
            </Button>
          </div>
        </div>
      </form>
    </SurfaceCard>
  );
}
