'use client';

import { useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
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

export type ClubProfileValues = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
};

/** The same slug rule the server applies, so the preview cannot promise a URL it would refuse. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Editing the club's own profile.
 *
 * The page states these four values read-only and opens this to change them,
 * rather than keeping a form permanently open on a screen that is mostly read.
 * The slug gets its own field and a live preview of the address it produces,
 * because changing it moves the club's public page — a consequence a reader
 * would otherwise discover from a broken link somebody else sent them.
 */
export function ClubProfileEditor({
  club,
  onClose,
  onSaved,
}: {
  club: ClubProfileValues;
  onClose: () => void;
  onSaved: (club: ClubProfileValues & { id: string }) => void;
}) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.dashboard.player.clubPage.editProfile;
  const [values, setValues] = useState<ClubProfileValues>(club);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const slugPreview = slugify(values.slug || values.name);
  const slugChanged = slugPreview !== club.slug;

  function update(field: keyof ClubProfileValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/account/club', {
        method: 'PATCH',
        body: JSON.stringify({ ...values, slug: slugPreview }),
      });
      const data = await readApiJson<{ club?: ClubProfileValues & { id: string }; error?: string }>(response, {});
      if (!response.ok || !data.club) {
        setError(data.error ?? copy.error);
        return;
      }
      onSaved(data.club);
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
          <Button
            type="button"
            variant="red"
            disabled={saving || values.name.trim().length < 2 || !slugPreview}
            onClick={save}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? copy.saving : copy.save}
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

        <DashboardField id="club-name" label={copy.nameLabel}>
          <input
            id="club-name"
            type="text"
            value={values.name}
            maxLength={80}
            disabled={saving}
            className={formControlClassName}
            onChange={(event) => update('name', event.target.value)}
          />
        </DashboardField>

        <DashboardField id="club-slug" label={copy.slugLabel} hint={copy.slugHint}>
          <input
            id="club-slug"
            type="text"
            value={values.slug}
            maxLength={80}
            disabled={saving}
            className={formControlClassName}
            onChange={(event) => update('slug', event.target.value)}
          />
        </DashboardField>

        <p className="rounded-lg border border-[#e7dcd8] bg-[#faf6f3] px-3 py-2.5 text-sm leading-6 text-[#6d5f5c]">
          <span className="font-medium text-[#3b302e]">/clubs/{slugPreview || '…'}</span>
          {slugChanged ? <span className="mt-1 block">{copy.slugMoves}</span> : null}
        </p>

        <DashboardField id="club-description" label={copy.descriptionLabel}>
          <textarea
            id="club-description"
            rows={3}
            value={values.description}
            maxLength={600}
            disabled={saving}
            className={formControlClassName}
            onChange={(event) => update('description', event.target.value)}
          />
        </DashboardField>

        <DashboardField id="club-logo" label={copy.logoLabel} hint={copy.logoHint}>
          <input
            id="club-logo"
            type="url"
            inputMode="url"
            value={values.logoUrl}
            maxLength={500}
            disabled={saving}
            className={formControlClassName}
            placeholder="https://"
            onChange={(event) => update('logoUrl', event.target.value)}
          />
        </DashboardField>
      </div>
    </DashboardModal>
  );
}
