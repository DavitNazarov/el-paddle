'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
} from '@/components/padel/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/padel/I18nProvider';
import { AdminShell } from './AdminShell';
import type { CategoryDto } from './types';

export function AdminCategoriesClient() {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.categoriesPage;
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const response = await apiFetch('/api/categories', { cache: 'no-store' });
    const data = (await response.json()) as { categories: CategoryDto[] };
    setCategories(data.categories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.categoryCreated);
    setForm({ name: '', description: '' });
    setCreateOpen(false);
    await load();
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-6 flex justify-end">
        <Button
          variant="red"
          onClick={() => {
            setForm({ name: '', description: '' });
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {copy.showCreate}
        </Button>
      </div>

      <SectionHeading title={copy.listTitle} description={copy.listDescription} />
      <div className="mt-4 grid gap-3">
        {loading ? <EmptyState title={copy.loading} icon={Tags} /> : null}
        {!loading && !categories.length ? (
          <EmptyState
            title={admin.events.noCategoriesTitle}
            description={admin.events.noCategoriesDescription}
            icon={Tags}
            action={
              <Button variant="red" onClick={() => setCreateOpen(true)}>
                {copy.showCreate}
              </Button>
            }
          />
        ) : null}
        {categories.map((category) => (
          <SurfaceCard key={category.id}>
            <CardContent className="p-5">
              <h3 className="text-lg font-semibold text-[var(--padel-ink)]">{category.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[rgba(19,2,2,0.58)]">
                {category.description || copy.noDescription}
              </p>
            </CardContent>
          </SurfaceCard>
        ))}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={copy.createTitle}
        description={copy.createDescription}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" className={softButtonClassName} onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="create-category-form" variant="red" disabled={busy}>
              <Plus className="h-4 w-4" />
              {busy ? admin.messages.saving : admin.events.saveCategory}
            </Button>
          </>
        }
      >
        <form id="create-category-form" onSubmit={createCategory} className="space-y-4">
          <DashboardField label={admin.events.name} id="category-name">
            <Input
              id="category-name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={admin.events.categoryPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.events.descriptionLabel} id="category-description" hint={t('common.optional')}>
            <Textarea
              id="category-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={admin.events.categoryDescriptionPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>
    </AdminShell>
  );
}
