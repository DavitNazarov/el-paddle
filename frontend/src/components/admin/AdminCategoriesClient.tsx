'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  FeedbackBanner,
  SectionHeading,
  formControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { AdminShell } from './AdminShell';
import { DirectoryTable, rowActionClassName } from './directory/DirectoryTable';
import { DirectoryToolbar } from './directory/DirectoryToolbar';
import { ConfirmModal, EditorModal } from './directory/DirectoryModals';
import {
  ALL_FACET,
  CATEGORY_FACET_VALUES,
  categoryInUse,
  categoryReader,
  emptyQuery,
  facetOptions,
  filterRows,
  type DirectoryQuery,
} from './directory/directoryModel';
import styles from './directory/Directory.module.css';
import type { CategoryDto } from '@/types/admin';

const emptyForm = { name: '', description: '' };

export function AdminCategoriesClient() {
  const { dictionary, locale, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.categoriesPage;
  const dir = tournamentCopy[locale].admin.directory;

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [query, setQuery] = useState<DirectoryQuery>(emptyQuery);
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
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

  const visible = useMemo(() => filterRows(categories, query, categoryReader), [categories, query]);
  const facets = useMemo(
    () =>
      facetOptions(categories, query, categoryReader, CATEGORY_FACET_VALUES, (value) =>
        value === ALL_FACET ? dir.all : value === 'IN_USE' ? dir.categoryInUse : dir.categoryUnused,
      ),
    [categories, dir, query],
  );

  /** One writer for the three commands: they differ only in route, method and message. */
  async function send(path: string, method: string, body: unknown, success: string) {
    setError('');
    setFormError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) return result.error ?? admin.messages.actionFailed;
    setMessage(success);
    await load();
    return null;
  }

  async function createCategory() {
    const failure = await send('/api/categories', 'POST', form, admin.messages.categoryCreated);
    if (failure) return setFormError(failure);
    setForm(emptyForm);
    setCreateOpen(false);
  }

  async function updateCategory() {
    if (!editing) return;
    const failure = await send(`/api/categories/${editing.id}`, 'PATCH', form, admin.messages.categoryUpdated);
    if (failure) return setFormError(failure);
    setForm(emptyForm);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const failure = await send(`/api/categories/${deleting.id}`, 'DELETE', undefined, admin.messages.categoryDeleted);
    if (failure) return setFormError(failure);
    setDeleting(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setCreateOpen(true);
  }

  function openEdit(category: CategoryDto) {
    setForm({ name: category.name, description: category.description });
    setFormError('');
    setEditing(category);
  }

  const createButton = (
    <Button variant="red" className="min-h-11 rounded-md" onClick={openCreate}>
      <Plus className="h-4 w-4" />
      {copy.showCreate}
    </Button>
  );

  const fields = (idPrefix: string) => (
    <>
      <DashboardField label={admin.events.name} id={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          required
          value={form.name}
          onChange={(fieldEvent) => setForm((current) => ({ ...current, name: fieldEvent.target.value }))}
          placeholder={admin.events.categoryPlaceholder}
          className={formControlClassName}
        />
      </DashboardField>
      <DashboardField label={admin.events.descriptionLabel} id={`${idPrefix}-description`} hint={t('common.optional')}>
        <Textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(fieldEvent) => setForm((current) => ({ ...current, description: fieldEvent.target.value }))}
          placeholder={admin.events.categoryDescriptionPlaceholder}
          className={formControlClassName}
        />
      </DashboardField>
    </>
  );

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={copy.listTitle} description={copy.listDescription} actions={createButton} />

      <DirectoryToolbar
        id="categories"
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        searchLabel={dir.searchCategories}
        countLabel={
          visible.length === categories.length
            ? fillTemplate(dir.total, { count: categories.length })
            : fillTemplate(dir.shown, { shown: visible.length, total: categories.length })
        }
      />

      <div className="mt-4">
        <DirectoryTable
          loading={loading}
          rows={visible}
          total={categories.length}
          icon={Tags}
          loadingLabel={copy.loading}
          rowKey={(category) => category.id}
          minWidthClassName="min-w-[720px]"
          actionsHeader={copy.columnActions}
          empty={{
            title: admin.events.noCategoriesTitle,
            description: admin.events.noCategoriesDescription,
            action: createButton,
          }}
          noMatches={{
            title: dir.noMatches,
            description: dir.noMatchesDetail,
            action: (
              <Button variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')} onClick={() => setQuery(emptyQuery)}>
                {dir.showAll}
              </Button>
            ),
          }}
          columns={[
            {
              key: 'name',
              header: copy.columnName,
              width: 'w-[30%]',
              cell: (category) => (
                <span className={styles.primary} title={category.name}>
                  {category.name}
                </span>
              ),
            },
            {
              key: 'description',
              header: copy.columnDescription,
              width: 'w-[40%]',
              cell: (category) => <p className={styles.wrapped}>{category.description || copy.noDescription}</p>,
            },
            {
              key: 'usage',
              header: copy.columnUsage,
              width: 'w-[16%]',
              cell: (category) =>
                categoryInUse(category) ? (
                  <Badge className="border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]">
                    {copy.inUseByEvents.replace('{count}', String(category.eventCount))}
                  </Badge>
                ) : (
                  <span className={styles.faint}>{copy.notInUse}</span>
                ),
            },
          ]}
          renderActions={(category) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className={cn(softButtonClassName, rowActionClassName)}
                aria-label={copy.edit}
                title={copy.edit}
                onClick={() => openEdit(category)}
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden 2xl:inline">{copy.edit}</span>
              </Button>
              {/* A category an event still points at cannot be deleted, so the action is absent
                  rather than permanently disabled; the usage column states why. */}
              {categoryInUse(category) ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 rounded-md border-[rgba(194,65,59,0.28)] bg-white text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]"
                  aria-label={copy.delete}
                  title={copy.delete}
                  onClick={() => {
                    setFormError('');
                    setDeleting(category);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden 2xl:inline">{copy.delete}</span>
                </Button>
              )}
            </>
          )}
        />
      </div>

      <EditorModal
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        title={copy.createTitle}
        description={copy.createDescription}
        formId="create-category-form"
        size="md"
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy ? admin.messages.saving : admin.events.saveCategory}
        onSubmit={() => void createCategory()}
      >
        {fields('category')}
      </EditorModal>

      <EditorModal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={copy.editTitle}
        description={copy.editDescription}
        formId="edit-category-form"
        size="md"
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy ? admin.messages.saving : copy.saveEdit}
        onSubmit={() => void updateCategory()}
      >
        {fields('edit-category')}
      </EditorModal>

      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={deleting ? copy.deleteDescription.replace('{name}', deleting.name) : copy.deleteDescription}
        body={copy.deleteWarning}
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        confirmLabel={busy ? admin.messages.saving : copy.confirmDelete}
        onConfirm={() => void confirmDelete()}
      />
    </AdminShell>
  );
}
