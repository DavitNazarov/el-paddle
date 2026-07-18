'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, LogOut, Plus, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { useLogout } from '@/hooks/useLogout';

type Step = 'choice' | 'create' | 'join' | 'mate';

type ClubOption = {
  id: string;
  name: string;
  slug: string;
};

type PendingClubRequest = {
  id: string;
  createdAt: string;
  club: ClubOption;
};

export function CompleteClubForm() {
  const router = useRouter();
  const { t } = useI18n();
  const { logout, loggingOut } = useLogout('/login');
  const [step, setStep] = useState<Step>('choice');
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [pendingRequest, setPendingRequest] = useState<PendingClubRequest | null>(null);
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [mateEmail, setMateEmail] = useState('');
  const [mateName, setMateName] = useState('');
  const [mateSurname, setMateSurname] = useState('');
  const [matePhone, setMatePhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const loadClubChoices = useCallback(async () => {
    try {
      const [clubsResponse, requestResponse] = await Promise.all([
        apiFetch('/api/public/clubs'),
        apiFetch('/api/account/club-requests/current'),
      ]);
      const clubsData = await readApiJson<{ clubs?: ClubOption[] }>(clubsResponse, {});
      const requestData = await readApiJson<{ clubRequest?: PendingClubRequest | null }>(
        requestResponse,
        {},
      );
      const nextClubs = clubsData.clubs ?? [];
      setClubs(nextClubs);
      setSelectedClubId((current) => current || nextClubs[0]?.id || '');
      setPendingRequest(requestData.clubRequest ?? null);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadClubChoices();
  }, [loadClubChoices]);

  const createClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/account/club', {
        method: 'POST',
        body: JSON.stringify({ name: clubName, description: clubDescription }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.completeClub.error'));
        return;
      }

      setPendingRequest(null);
      setStep('mate');
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const requestToJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClubId) return;
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/account/club-requests', {
        method: 'POST',
        body: JSON.stringify({ clubId: selectedClubId }),
      });
      const data = await readApiJson<{
        error?: string;
        clubRequest?: PendingClubRequest;
      }>(response, {});

      if (!response.ok || !data.clubRequest) {
        setError(data.error ?? t('forms.completeClub.requestError'));
        return;
      }

      setPendingRequest(data.clubRequest);
      setStep('choice');
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const openDashboardIfApproved = useCallback(async () => {
    const response = await apiFetch('/api/auth/me');
    const data = await readApiJson<{ user?: PublicUser | null }>(response, {});
    if (!data.user?.club) return false;

    router.replace('/dashboard/club');
    router.refresh();
    return true;
  }, [router]);

  const refreshRequestStatus = useCallback(async () => {
    if (await openDashboardIfApproved()) return;
    await loadClubChoices();
  }, [loadClubChoices, openDashboardIfApproved]);

  useEffect(() => {
    if (!pendingRequest || step !== 'choice') return;

    const intervalId = window.setInterval(() => {
      void refreshRequestStatus().catch(() => {
        // Background checks stay silent; the manual check provides visible error feedback.
      });
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [pendingRequest, refreshRequestStatus, step]);

  const checkRequestStatus = async () => {
    setLoading(true);
    setError('');
    try {
      await refreshRequestStatus();
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

      router.push('/dashboard/club');
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const heading =
    step === 'create'
      ? t('forms.completeClub.createTitle')
      : step === 'join'
        ? t('forms.completeClub.joinTitle')
        : step === 'mate'
          ? t('forms.register.mateTitle')
          : t('forms.completeClub.title');
  const copy =
    step === 'create'
      ? t('forms.completeClub.createCopy')
      : step === 'join'
        ? t('forms.completeClub.joinCopy')
        : step === 'mate'
          ? t('forms.register.mateCopy')
          : t('forms.completeClub.copy');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.completeClub.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">{heading}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">{copy}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'choice' ? (
        <div className="space-y-4">
          {pendingRequest ? (
            <Alert className="border-emerald-700/20 bg-emerald-50 text-emerald-950">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <AlertDescription>
                  <span className="block">
                    {t('forms.completeClub.requestSent', { club: pendingRequest.club.name })}
                  </span>
                  <span className="mt-1 block text-sm text-emerald-950/70">
                    {t('forms.completeClub.requestPendingHelp')}
                  </span>
                </AlertDescription>
              </div>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('join');
              }}
              className="min-h-32 cursor-pointer rounded-xl border border-[var(--padel-ink)]/15 bg-white p-5 text-left transition-colors duration-200 hover:border-[var(--padel-red)]/45 hover:bg-[var(--padel-red)]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
            >
              <Send className="h-5 w-5 text-[var(--padel-red)]" />
              <span className="mt-4 block font-semibold">{t('forms.completeClub.joinTitle')}</span>
              <span className="mt-1 block text-sm leading-5 text-[var(--padel-ink)]/60">
                {t('forms.completeClub.joinCopy')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('create');
              }}
              className="min-h-32 cursor-pointer rounded-xl border border-[var(--padel-ink)]/15 bg-white p-5 text-left transition-colors duration-200 hover:border-[var(--padel-red)]/45 hover:bg-[var(--padel-red)]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
            >
              <Plus className="h-5 w-5 text-[var(--padel-red)]" />
              <span className="mt-4 block font-semibold">{t('forms.completeClub.createTitle')}</span>
              <span className="mt-1 block text-sm leading-5 text-[var(--padel-ink)]/60">
                {t('forms.completeClub.createCopy')}
              </span>
            </button>
          </div>

          {pendingRequest ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={checkRequestStatus}
              className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)]"
            >
              {loading
                ? t('forms.completeClub.checkingStatus')
                : t('forms.completeClub.checkStatus')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === 'join' ? (
        <form onSubmit={requestToJoin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="club-select">{t('forms.completeClub.selectClub')}</Label>
            <select
              id="club-select"
              required
              disabled={loadingOptions || clubs.length === 0}
              value={selectedClubId}
              onChange={(event) => setSelectedClubId(event.target.value)}
              className={cn(authInputClassName, 'min-h-12 w-full rounded-md border px-3')}
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            variant="red"
            size="lg"
            disabled={loading || loadingOptions || !selectedClubId}
            className="min-h-12 w-full"
          >
            {loading
              ? t('forms.completeClub.sendingRequest')
              : t('forms.completeClub.sendRequest')}
            <Send className="h-5 w-5" />
          </Button>
          <BackButton onClick={() => setStep('choice')} label={t('forms.completeClub.backToChoices')} />
        </form>
      ) : null}

      {step === 'create' ? (
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
          <Button
            type="submit"
            variant="red"
            size="lg"
            disabled={loading || clubName.trim().length < 2}
            className="min-h-12 w-full"
          >
            {loading ? t('forms.register.savingClub') : t('forms.register.continue')}
            <ArrowRight className="h-5 w-5" />
          </Button>
          <BackButton onClick={() => setStep('choice')} label={t('forms.completeClub.backToChoices')} />
        </form>
      ) : null}

      {step === 'mate' ? (
        <form onSubmit={addMate} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--padel-ink)]/10 bg-white/60 p-4">
            <Building2 className="h-5 w-5 text-[var(--padel-red)]" />
            <p className="text-sm text-[var(--padel-ink)]/70">
              {t('forms.register.mateCopy')}
            </p>
          </div>
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
                router.push('/dashboard/club');
                router.refresh();
              }}
            >
              {t('forms.register.skipMate')}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="border-t border-[var(--padel-ink)]/10 pt-5 text-center">
        <p className="text-sm text-[var(--padel-ink)]/60">
          {t('forms.completeClub.switchAccountPrompt')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={loggingOut}
          onClick={logout}
          className="mt-2 min-h-12 w-full text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/[0.06]"
        >
          <LogOut className="h-5 w-5" />
          {loggingOut
            ? t('forms.completeClub.switchingAccount')
            : t('forms.completeClub.switchAccount')}
        </Button>
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      onClick={onClick}
      className="min-h-12 w-full text-[var(--padel-ink)]"
    >
      <ArrowLeft className="h-5 w-5" />
      {label}
    </Button>
  );
}
