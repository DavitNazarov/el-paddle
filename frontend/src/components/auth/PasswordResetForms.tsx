'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';
import { friendlyError } from '@/lib/utils/errors';

function Heading({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">{kicker}</p>
      <h2 className="font-display mt-2 text-4xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">{copy}</p>
    </div>
  );
}

/**
 * Step one: ask for a link.
 *
 * The confirmation is deliberately the same whether or not the address has an
 * account — the server answers identically, and saying "no such account" here
 * would hand back exactly what the server refuses to disclose.
 */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.forgotPassword.error'), t('forms.apiConnectionError')));
        return;
      }
      setSent(true);
    } catch {
      setError(t('forms.apiConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <Heading
          kicker={t('forms.forgotPassword.kicker')}
          title={t('forms.forgotPassword.sentTitle')}
          copy={t('forms.forgotPassword.sentCopy')}
        />
        <div className="flex items-start gap-3 rounded-md border border-[var(--padel-ink)]/15 bg-[var(--padel-ink)]/[0.03] p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--padel-red)]" aria-hidden />
          <p className="text-sm leading-6 text-[var(--padel-ink)]/75">{t('forms.forgotPassword.sentNote')}</p>
        </div>
        <Button asChild variant="red" size="lg" className="min-h-12 w-full">
          <Link href="/login">{t('forms.forgotPassword.backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Heading
        kicker={t('forms.forgotPassword.kicker')}
        title={t('forms.forgotPassword.title')}
        copy={t('forms.forgotPassword.copy')}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-email">{t('common.email')}</Label>
        <Input
          id="reset-email"
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={authInputClassName}
        />
      </div>

      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? t('forms.forgotPassword.sending') : t('forms.forgotPassword.submit')}
        <ArrowRight className="h-5 w-5" />
      </Button>

      <p className="text-center text-sm text-[var(--padel-ink)]/65">
        <Link href="/login" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
          {t('forms.forgotPassword.backToLogin')}
        </Link>
      </p>
    </form>
  );
}

/**
 * Step two: choose the new password.
 *
 * Redeeming the link signs every device out, so the person lands on the login
 * page and proves the new password works rather than being signed in here.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError(t('forms.resetPassword.mismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});
      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.resetPassword.error'), t('forms.apiConnectionError')));
        return;
      }
      router.push('/login?reset=done');
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Heading
        kicker={t('forms.resetPassword.kicker')}
        title={t('forms.resetPassword.title')}
        copy={t('forms.resetPassword.copy')}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password">{t('forms.resetPassword.newPassword')}</Label>
          <Input
            id="new-password"
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={authInputClassName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t('forms.resetPassword.confirmPassword')}</Label>
          <Input
            id="confirm-password"
            required
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={authInputClassName}
          />
        </div>
      </div>

      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? t('forms.resetPassword.saving') : t('forms.resetPassword.submit')}
        <ArrowRight className="h-5 w-5" />
      </Button>
    </form>
  );
}

/** The link was opened without its token — usually a mail client truncating it. */
export function MissingResetToken() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <Heading
        kicker={t('forms.resetPassword.kicker')}
        title={t('forms.resetPassword.missingTitle')}
        copy={t('forms.resetPassword.missingCopy')}
      />
      <Button asChild variant="red" size="lg" className="min-h-12 w-full">
        <Link href="/forgot-password">{t('forms.resetPassword.requestAnother')}</Link>
      </Button>
    </div>
  );
}
