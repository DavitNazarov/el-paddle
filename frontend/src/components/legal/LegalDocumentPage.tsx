'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';
import { legalBusiness, legalDocuments, type LegalDocumentSlug } from '@/lib/legal';

export function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const { locale } = useI18n();
  const document = legalDocuments[slug];
  const missingId = legalBusiness.identificationNumber.startsWith('SET-');
  const label = (value: { en: string; ka: string }) => value[locale];

  return (
    <main className="min-h-screen bg-[#f5efe3] text-[var(--padel-ink)]">
      <header className="border-b border-[rgba(88,16,16,0.12)] bg-[var(--padel-ink)] text-[var(--padel-ivory)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">
            <ArrowLeft className="h-4 w-4" /> El Padel
          </Link>
          <LanguageSwitcher tone="dark" />
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--padel-red)]">
            {locale === 'ka' ? 'იურიდიული ინფორმაცია' : 'Legal information'}
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{label(document.title)}</h1>
          <p className="mt-5 text-base leading-7 text-[rgba(88,16,16,0.68)] sm:text-lg">{label(document.summary)}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(88,16,16,0.48)]">
            {locale === 'ka' ? 'ძალაშია' : 'Effective'}: 17 July 2026 · {locale === 'ka' ? 'ვერსია' : 'Version'} {document.version}
          </p>
        </div>

        {missingId ? (
          <div role="alert" className="mt-8 flex max-w-3xl gap-3 rounded-lg border border-amber-500/35 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{locale === 'ka' ? 'გამოქვეყნებამდე გარემოს ცვლადში დაამატეთ ორგანიზაციის საიდენტიფიკაციო ნომერი: NEXT_PUBLIC_LEGAL_ENTITY_ID.' : 'Before launch, set the organization identification number in NEXT_PUBLIC_LEGAL_ENTITY_ID.'}</p>
          </div>
        ) : null}

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
          <div className="space-y-10">
            {document.sections.map((section) => (
              <section key={section.title.en} className="scroll-mt-6 border-t border-[rgba(88,16,16,0.12)] pt-7">
                <h2 className="font-display text-2xl font-semibold">{label(section.title)}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph.en} className="mt-4 text-[0.98rem] leading-7 text-[rgba(88,16,16,0.76)]">{label(paragraph)}</p>
                ))}
                {section.items ? (
                  <ul className="mt-4 space-y-3 text-[0.98rem] leading-7 text-[rgba(88,16,16,0.76)]">
                    {section.items.map((item) => <li key={item.en} className="relative pl-5 before:absolute before:left-0 before:top-[0.7rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--padel-red)]">{label(item)}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="rounded-xl border border-[rgba(88,16,16,0.12)] bg-white/55 p-5 lg:sticky lg:top-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-red)]">{locale === 'ka' ? 'ორგანიზაციის მონაცემები' : 'Business details'}</h2>
            <dl className="mt-4 space-y-3 text-sm leading-6">
              <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'დასახელება' : 'Name'}</dt><dd className="font-semibold">{legalBusiness.name}</dd></div>
              <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'სამართლებრივი ფორმა' : 'Legal form'}</dt><dd>{legalBusiness.legalForm}</dd></div>
              <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'საიდენტიფიკაციო ნომერი' : 'Identification number'}</dt><dd className="break-words">{legalBusiness.identificationNumber}</dd></div>
              <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'მისამართი' : 'Address'}</dt><dd>{legalBusiness.address}</dd></div>
              <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'ელფოსტა' : 'Email'}</dt><dd><a className="font-semibold underline underline-offset-4" href={`mailto:${legalBusiness.email}`}>{legalBusiness.email}</a></dd></div>
              {legalBusiness.phone ? <div><dt className="text-[rgba(88,16,16,0.5)]">{locale === 'ka' ? 'ტელეფონი' : 'Phone'}</dt><dd><a href={`tel:${legalBusiness.phone}`}>{legalBusiness.phone}</a></dd></div> : null}
            </dl>
          </aside>
        </div>
      </article>
    </main>
  );
}
