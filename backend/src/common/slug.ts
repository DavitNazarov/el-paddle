export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

/** Reject empty / traversal-like slugs after normalization. */
export function isSafeSlug(slug: string) {
  return Boolean(slug) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !slug.includes('..');
}
