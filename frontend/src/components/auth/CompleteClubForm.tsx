'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';
import { cn } from '@/lib/utils';

type Step = 'club' | 'mate';

export function CompleteClubForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('club');
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [mateEmail, setMateEmail] = useState('');
  const [mateName, setMateName] = useState('');
  const [mateSurname, setMateSurname] = useState('');
  const [matePhone, setMatePhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/account/club', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: clubName, description: clubDescription }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.completeClub.error'));
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.completeClub.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">
          {step === 'club' ? t('forms.completeClub.title') : t('forms.register.mateTitle')}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          {step === 'club' ? t('forms.completeClub.copy') : t('forms.register.mateCopy')}
        </p>
      </div>

      <ol className="grid grid-cols-2 gap-2">
        {[t('forms.register.steps.club'), t('forms.register.steps.mate')].map((label, index) => (
          <li key={label}>
            <div
              className={cn(
                'h-1 rounded-full',
                (step === 'club' ? 0 : 1) >= index ? 'bg-[var(--padel-red)]' : 'bg-[var(--padel-ink)]/12',
              )}
            />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--padel-red)]">
              {label}
            </p>
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'club' ? (
        <form onSubmit={createClub} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="club-name">{t('forms.register.clubName')}</Label>
            <Input
              id="club-name"
              required
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              className={authInputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-description">{t('forms.register.clubDescription')}</Label>
            <Input
              id="club-description"
              value={clubDescription}
              onChange={(event) => setClubDescription(event.target.value)}
              className={authInputClassName}
              placeholder={t('common.optional')}
            />
          </div>
          <Button type="submit" variant="red" size="lg" disabled={loading || clubName.trim().length < 2} className="min-h-12 w-full">
            {loading ? t('forms.register.savingClub') : t('forms.register.continue')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : (
        <form onSubmit={addMate} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="mate-email">{t('common.email')}</Label>
            <Input
              id="mate-email"
              required
              type="email"
              value={mateEmail}
              onChange={(event) => setMateEmail(event.target.value)}
              className={authInputClassName}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mate-name">{t('common.name')}</Label>
              <Input
                id="mate-name"
                required
                value={mateName}
                onChange={(event) => setMateName(event.target.value)}
                className={authInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mate-surname">{t('common.surname')}</Label>
              <Input
                id="mate-surname"
                required
                value={mateSurname}
                onChange={(event) => setMateSurname(event.target.value)}
                className={authInputClassName}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mate-phone">{t('common.phone')}</Label>
            <Input
              id="mate-phone"
              type="tel"
              value={matePhone}
              onChange={(event) => setMatePhone(event.target.value)}
              className={authInputClassName}
              placeholder={t('common.optional')}
            />
          </div>
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
              className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)]"
              onClick={() => {
                router.push('/dashboard');
                router.refresh();
              }}
            >
              {t('forms.register.skipMate')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
