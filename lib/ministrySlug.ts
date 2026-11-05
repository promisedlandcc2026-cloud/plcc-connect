/**
 * Stable URL slugs for ministry hubs — derived from live ministry names.
 */

export function slugifyMinistryName(name: string): string {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'ministry';
}

/** Find a ministry by URL slug (exact match on slugified name). */
export function findMinistryBySlug<T extends { name: string }>(
  ministries: T[],
  slug: string
): T | null {
  const target = String(slug || '')
    .trim()
    .toLowerCase();
  if (!target) return null;
  return ministries.find((m) => slugifyMinistryName(m.name) === target) || null;
}
