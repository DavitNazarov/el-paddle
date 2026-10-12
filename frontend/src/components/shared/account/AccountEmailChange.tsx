'use client';

import { useState } from 'react';
import { AtSign, LoaderCircle, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DashboardField,
  DashboardModal,
  FeedbackBanner,
  SurfaceCard,
  formControlClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, fillTemplate } from '@/lib/i18n/tournament';
import { apiFetch, readApiJson } from '@/lib/api';

/**
 * Changing the address the account signs in with.
 *
 * Two steps, in one dialog, because they are one decision: name the new address,
 * then prove you can read its inbox. The code is sent to the *new* address —
 * that is the whole point of it — and the dialog says so, so nobody waits for a
 * mail at the address they are trying to leave.
 *
 * The current address is stated read-only on the card. Nothing here is a form
 * sitting permanently open on a screen that is otherwise read.
 */
export function AccountEmailChange({
  currentEmail,
  hasPassword,
  onChanged,
}: {
  currentEmail: string;
  hasPassword: boolean;
  onChanged: (email: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].account.email;
  const common = tournamentCopy[locale].common;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'address' | 'code'>('address');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setStep('address');
    setEmail('');
    setPassword('');
    setCode('');
    setError('');
  }

  async function requestCode() {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/account/email', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.requestError);
        return;
      }
      setStep('code');
    } catch {
      setError(copy.requestError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/account/email/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await readApiJson<{ email?: string; error?: string }>(response, {});
      if (!response.ok || !data.email) {
        setError(data.error ?? copy.confirmError);
        return;
      }
      onChanged(data.email);
      close();
    } catch {
      setError(copy.confirmError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SurfaceCard className="mt-4">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
              <AtSign className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--dash-text)]">{copy.title}</h3>
              <p className="mt-1 break-all text-sm leading-5 text-[var(--dash-muted)]">{currentEmail}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-md px-4 sm:shrink-0"
          >
            {copy.action}
          </Button>
        </div>
      </SurfaceCard>

      <DashboardModal
        open={open}
        onOpenChange={(next) => { if (!next) close(); }}
        title={copy.title}
        description={step === 'address' ? copy.addressStep : fillTemplate(copy.codeStep, { email })}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className={modalSoftButtonClassName}
              disabled={busy}
              onClick={close}
            >
              {common.cancel}
            </Button>
            <Button
              type="button"
              variant="red"
              disabled={busy || (step === 'address' ? !email.trim() : code.trim().length < 4)}
              onClick={() => { void (step === 'address' ? requestCode() : confirmCode()); }}
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <MailCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {step === 'address' ? copy.sendCode : copy.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

          {step === 'address' ? (
            <>
              <DashboardField id="new-email" label={copy.newEmailLabel} hint={copy.newEmailHint}>
                <input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  disabled={busy}
                  className={formControlClassName}
                  onChange={(fieldEvent) => setEmail(fieldEvent.target.value)}
                />
              </DashboardField>
              {hasPassword ? (
                <DashboardField id="email-password" label={copy.passwordLabel} hint={copy.passwordHint}>
                  <input
                    id="email-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={busy}
                    className={formControlClassName}
                    onChange={(fieldEvent) => setPassword(fieldEvent.target.value)}
                  />
                </DashboardField>
              ) : null}
            </>
          ) : (
            <DashboardField id="email-code" label={copy.codeLabel} hint={copy.codeHint}>
              <input
                id="email-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                disabled={busy}
                className={formControlClassName}
                onChange={(fieldEvent) => setCode(fieldEvent.target.value)}
              />
            </DashboardField>
          )}

          <p className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5 text-sm leading-6 text-[#6d5f5c]">
            {copy.consequence}
          </p>
        </div>
      </DashboardModal>
    </>
  );
}
