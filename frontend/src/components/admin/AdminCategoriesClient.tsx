'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { AdminShell } from './AdminShell';
import type { CategoryDto } from '@/types/admin';

const emptyForm = { name: '', description: '' };

export function AdminCategoriesClient() {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.categoriesPage;
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);
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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
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
    setForm(emptyForm);
    setCreateOpen(false);
    await load();
  }

  async function updateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(`/api/categories/${editing.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.categoryUpdated);
    setForm(emptyForm);
    setEditing(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(`/api/categories/${deleting.id}`, {
      method: 'DELETE',
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      setDeleting(null);
      return;
    }
    setMessage(admin.messages.categoryDeleted);
    setDeleting(null);
    await load();
  }

  function openEdit(category: CategoryDto) {
    setError('');
    setMessage('');
    setForm({ name: category.name, description: category.description });
    setEditing(category);
  }

  function openDelete(category: CategoryDto) {
    setError('');
    setMessage('');
    if ((category.eventCount ?? 0) > 0) {
      setError(admin.messages.categoryInUse);
      return;
    }
    setDeleting(category);
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-6 flex justify-end">
        <Button
          variant="red"
          className="rounded-md"
          onClick={() => {
            setForm(emptyForm);
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
              <Button variant="red" className="rounded-md" onClick={() => setCreateOpen(true)}>
                {copy.showCreate}
              </Button>
            }
          />
        ) : null}
        {categories.map((category, index) => {
          const inUse = (category.eventCount ?? 0) > 0;
          return (
            <Reveal key={category.id} delay={Math.min(index * 0.04, 0.2)}>
              <SurfaceCard>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-[var(--padel-ivory)]">{category.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[rgba(213,201,177,0.55)]">
                      {category.description || copy.noDescription}
                    </p>
                    {inUse ? (
                      <p className="mt-2 text-xs text-[rgba(213,201,177,0.4)]">
                        {copy.inUseByEvents.replace('{count}', String(category.eventCount))}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(softButtonClassName, 'rounded-md')}
                      onClick={() => openEdit(category)}
                    >
                      <Pencil className="h-4 w-4" />
                      {copy.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(softButtonClassName, 'rounded-md')}
                      disabled={inUse}
                      title={inUse ? admin.messages.categoryInUse : undefined}
                      onClick={() => openDelete(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {copy.delete}
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
            </Reveal>
          );
        })}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={copy.createTitle}
        description={copy.createDescription}
        size="md"
        footer={
          <ModalFormFooter
            formId="create-category-form"
            onCancel={() => setCreateOpen(false)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitLabel={
              <>
                <Plus className="h-4 w-4" />
                {busy ? admin.messages.saving : admin.events.saveCategory}
              </>
            }
          />
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

      <DashboardModal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={copy.editTitle}
        description={copy.editDescription}
        size="md"
        footer={
          <ModalFormFooter
            formId="edit-category-form"
            onCancel={() => setEditing(null)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitLabel={busy ? admin.messages.saving : copy.saveEdit}
          />
        }
      >
        <form id="edit-category-form" onSubmit={updateCategory} className="space-y-4">
          <DashboardField label={admin.events.name} id="edit-category-name">
            <Input
              id="edit-category-name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={admin.events.categoryPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.events.descriptionLabel} id="edit-category-description" hint={t('common.optional')}>
            <Textarea
              id="edit-category-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={admin.events.categoryDescriptionPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={
          deleting
            ? copy.deleteDescription.replace('{name}', deleting.name)
            : copy.deleteDescription
        }
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setDeleting(null)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitType="button"
            onSubmitClick={() => {
              void confirmDelete();
            }}
            submitLabel={busy ? admin.messages.saving : copy.confirmDelete}
          />
        }
      >
        <p className="text-sm leading-6 text-[#6d5f5c]">{copy.deleteWarning}</p>
      </DashboardModal>
    </AdminShell>
  );
}
