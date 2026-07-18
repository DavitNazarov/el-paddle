'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, apiUrl, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';
import { friendlyError } from '@/lib/utils/errors';
import { cn } from '@/lib/utils';

type Step = 'account' | 'verify' | 'club' | 'mate';

export function RegisterForm({ oauthError }: { oauthError?: string }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>('account');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [mateEmail, setMateEmail] = useState('');
  const [mateName, setMateName] = useState('');
  const [mateSurname, setMateSurname] = useState('');
  const [matePhone, setMatePhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);

  const stepIndex = step === 'account' ? 0 : step === 'verify' ? 1 : step === 'club' ? 2 : 3;
  const stepLabels = [
    t('forms.register.steps.account'),
    t('forms.register.steps.verify'),
    t('forms.register.steps.club'),
    t('forms.register.steps.mate'),
  ];

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, surname, phone, password, legalAccepted, eligibilityConfirmed }),
      });
      const data = await readApiJson<{ error?: string; message?: string }>(response, {});

      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.register.createError'), t('forms.databaseNotReady')));
        return;
      }

      setStep('verify');
      setMessage(data.message ?? t('forms.register.sent'));
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const verifyAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await readApiJson<{ error?: string; user?: { role?: string; club?: unknown } }>(response, {});

      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.register.verifyError'), t('forms.databaseNotReady')));
        return;
      }

      if (data.user?.role === 'ADMIN') {
        router.push('/admin');
        router.refresh();
        return;
      }

      if (data.user?.club) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      setStep('club');
      setMessage('');
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const createClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/account/club', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: clubName, description: clubDescription }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.register.clubError'));
        return;
      }

      setStep('mate');
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const addMate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/account/club/mate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: mateEmail,
          name: mateName,
          surname: mateSurname,
          phone: matePhone,
        }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.register.mateError'));
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === 'account'
      ? t('forms.register.profileTitle')
      : step === 'verify'
        ? t('forms.register.verifyTitle')
        : step === 'club'
          ? t('forms.register.clubTitle')
          : t('forms.register.mateTitle');

  const copy =
    step === 'account'
      ? t('forms.register.profileCopy')
      : step === 'verify'
        ? t('forms.register.verifyCopy', { email })
        : step === 'club'
          ? t('forms.register.clubCopy')
          : t('forms.register.mateCopy');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.register.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">{copy}</p>
      </div>

      <ol className="grid grid-cols-4 gap-2">
        {stepLabels.map((label, index) => (
          <li key={label} className="min-w-0">
            <div
              className={cn(
                'h-1 rounded-full',
                index <= stepIndex ? 'bg-[var(--padel-red)]' : 'bg-[var(--padel-ink)]/12',
              )}
            />
            <p
              className={cn(
                'mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.12em]',
                index <= stepIndex ? 'text-[var(--padel-red)]' : 'text-[var(--padel-ink)]/35',
              )}
            >
              {label}
            </p>
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive" className="overflow-hidden">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {oauthError === 'legal-consent-required' ? (
        <Alert variant="destructive"><AlertDescription>{locale === 'ka' ? 'Google-ით ახალი ანგარიშის შესაქმნელად ჯერ დაეთანხმეთ პირობებს და დაადასტურეთ ასაკი/მეურვის ნებართვა.' : 'To create a new account with Google, first accept the legal terms and confirm your age or guardian authorization.'}</AlertDescription></Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'account' ? (
        <form onSubmit={createAccount} className="space-y-5">
          <Field id="email" label={t('common.email')}>
            <Input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClassName} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={t('common.name')}>
              <Input id="name" required autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} className={authInputClassName} />
            </Field>
            <Field id="surname" label={t('common.surname')}>
              <Input id="surname" required autoComplete="family-name" value={surname} onChange={(event) => setSurname(event.target.value)} className={authInputClassName} />
            </Field>
          </div>
          <Field id="phone" label={t('common.phone')}>
            <Input id="phone" required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={authInputClassName} />
          </Field>
          <Field id="password" label={t('common.password')}>
            <Input id="password" required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClassName} />
          </Field>
          <div className="space-y-3 rounded-lg border border-[var(--padel-ink)]/12 bg-[var(--padel-ink)]/[0.035] p-4 text-sm leading-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input className="mt-1 h-5 w-5 shrink-0 accent-[var(--padel-red)]" type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required />
              <span>{locale === 'ka' ? 'ვეთანხმები ' : 'I agree to the '}<Link className="font-semibold underline underline-offset-4" href="/legal/terms" target="_blank">{locale === 'ka' ? 'გამოყენების პირობებს' : 'Terms of Use'}</Link>{locale === 'ka' ? ' და გავეცანი ' : ' and acknowledge the '}<Link className="font-semibold underline underline-offset-4" href="/legal/privacy" target="_blank">{locale === 'ka' ? 'კონფიდენციალურობის პოლიტიკას' : 'Privacy Policy'}</Link>.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input className="mt-1 h-5 w-5 shrink-0 accent-[var(--padel-red)]" type="checkbox" checked={eligibilityConfirmed} onChange={(event) => setEligibilityConfirmed(event.target.checked)} required />
              <span>{locale === 'ka' ? 'ვადასტურებ, რომ ვარ სულ მცირე 18 წლის ან მაქვს მშობლის/კანონიერი მეურვის ნებართვა.' : 'I confirm that I am at least 18 or have authorization from a parent or legal guardian.'}</span>
            </label>
          </div>
          <Button type="submit" variant="red" size="lg" disabled={loading || !legalAccepted || !eligibilityConfirmed} className="min-h-12 w-full">
            {loading ? t('forms.register.sending') : t('forms.register.continue')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={verifyAccount} className="space-y-5">
          <Field id="code" label={t('forms.register.verificationCode')}>
            <Input id="code" required inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" className={authInputClassName} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
            {loading ? t('forms.register.verifying') : t('forms.register.continue')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : null}

      {step === 'club' ? (
        <form onSubmit={createClub} className="space-y-5">
          <Field id="club-name" label={t('forms.register.clubName')}>
            <Input id="club-name" required value={clubName} onChange={(event) => setClubName(event.target.value)} className={authInputClassName} />
          </Field>
          <Field id="club-description" label={t('forms.register.clubDescription')}>
            <Input id="club-description" value={clubDescription} onChange={(event) => setClubDescription(event.target.value)} className={authInputClassName} placeholder={t('common.optional')} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading || clubName.trim().length < 2} className="min-h-12 w-full">
            {loading ? t('forms.register.savingClub') : t('forms.register.continue')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : null}

      {step === 'mate' ? (
        <form onSubmit={addMate} className="space-y-5">
          <Field id="mate-email" label={t('common.email')}>
            <Input id="mate-email" required type="email" value={mateEmail} onChange={(event) => setMateEmail(event.target.value)} className={authInputClassName} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mate-name" label={t('common.name')}>
              <Input id="mate-name" required value={mateName} onChange={(event) => setMateName(event.target.value)} className={authInputClassName} />
            </Field>
            <Field id="mate-surname" label={t('common.surname')}>
              <Input id="mate-surname" required value={mateSurname} onChange={(event) => setMateSurname(event.target.value)} className={authInputClassName} />
            </Field>
          </div>
          <Field id="mate-phone" label={t('common.phone')}>
            <Input id="mate-phone" type="tel" value={matePhone} onChange={(event) => setMatePhone(event.target.value)} className={authInputClassName} placeholder={t('common.optional')} />
          </Field>
          <div className="grid gap-3">
            <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
              {loading ? t('forms.register.savingMate') : t('forms.register.finish')}
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5"
              onClick={() => {
                router.push('/dashboard');
                router.refresh();
              }}
            >
              {t('forms.register.skipMate')}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'account' || step === 'verify' ? (
        <>
          <Button asChild={legalAccepted && eligibilityConfirmed} variant="outline" size="lg" disabled={!legalAccepted || !eligibilityConfirmed} className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5 hover:text-[var(--padel-ink)]">
            {legalAccepted && eligibilityConfirmed ? <a href={apiUrl('/api/auth/google?legalAccepted=true&eligibilityConfirmed=true')}>
              <Mail className="h-5 w-5" />
              {t('forms.register.gmail')}
            </a> : <span><Mail className="h-5 w-5" />{t('forms.register.gmail')}</span>}
          </Button>
          <p className="text-center text-sm text-[var(--padel-ink)]/65">
            {t('forms.register.alreadyRegistered')}{' '}
            <Link href="/login" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
              {t('forms.register.login')}
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
