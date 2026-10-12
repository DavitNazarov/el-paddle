'use client';

import { useState } from 'react';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DashboardField,
  DashboardModal,
  formControlClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch, readApiJson } from '@/lib/api';

/**
 * Adding a player to the club.
 *
 * The endpoint has existed since clubs did, but the only screen that ever
 * called it was the one-off signup form — so a leader who wanted an eighth
 * player after the club was created had no way to say so anywhere in the app.
 *
 * Two outcomes, and the difference matters to the leader: an address with no
 * account is invited and has to accept, while an address that already belongs
 * to an active player is refused, because moving somebody between clubs behind
 * their back is not an invitation. The server says which; this repeats it.
 */
export function ClubMateInvite({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (result: { name: string; invited: boolean }) => void;
}) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.clubPage.inviteMember;
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ready = form.name.trim() && form.surname.trim() && form.email.trim();

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function invite() {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/account/club/mate', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          surname: form.surname.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        }),
      });
      const data = await readApiJson<{ invited?: boolean; error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.error);
        return;
      }
      onInvited({
        name: `${form.name.trim()} ${form.surname.trim()}`.trim(),
        invited: data.invited ?? true,
      });
    } catch {
      setError(copy.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardModal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={copy.title}
      description={copy.description}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={modalSoftButtonClassName}
            disabled={saving}
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="red" disabled={saving || !ready} onClick={invite}>
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? copy.sending : copy.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardField id="mate-name" label={copy.nameLabel}>
            <input
              id="mate-name"
              type="text"
              autoComplete="given-name"
              value={form.name}
              disabled={saving}
              className={formControlClassName}
              onChange={(event) => update('name', event.target.value)}
            />
          </DashboardField>
          <DashboardField id="mate-surname" label={copy.surnameLabel}>
            <input
              id="mate-surname"
              type="text"
              autoComplete="family-name"
              value={form.surname}
              disabled={saving}
              className={formControlClassName}
              onChange={(event) => update('surname', event.target.value)}
            />
          </DashboardField>
        </div>

        <DashboardField id="mate-email" label={copy.emailLabel} hint={copy.emailHint}>
          <input
            id="mate-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            disabled={saving}
            className={formControlClassName}
            onChange={(event) => update('email', event.target.value)}
          />
        </DashboardField>

        <DashboardField id="mate-phone" label={copy.phoneLabel} hint={copy.phoneHint}>
          <input
            id="mate-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            disabled={saving}
            className={formControlClassName}
            onChange={(event) => update('phone', event.target.value)}
          />
        </DashboardField>

        <p className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5 text-sm leading-6 text-[#6d5f5c]">
          {copy.consequence}
        </p>
      </div>
    </DashboardModal>
  );
}
