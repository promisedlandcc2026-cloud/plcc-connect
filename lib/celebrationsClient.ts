/**
 * Celebrations & anniversary type — authenticated Supabase RPCs
 * (docs/supabase/connect_celebrations.sql). Server enforces directory privacy.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { ANNIVERSARY_LABEL_MAX, asAnniversaryKind as asKind, asTrimmed as asStr, sanitizeCelebration, type AnniversaryKind, type Celebration } from './blessings';

export { sanitizeCelebration };

export class CelebrationsUnavailableError extends Error {
  constructor() {
    super('Celebrations are not set up yet.');
    this.name = 'CelebrationsUnavailableError';
  }
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === 'PGRST202' || /could not find.*function|schema cache/i.test(String(error.message || ''))));
}

async function hasSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user?.id);
}

/** Birthdays & anniversaries in the next `days` days. Empty when not set up or signed out. */
export async function listCelebrations(days = 7): Promise<Celebration[]> {
  if (!(await hasSession())) return [];
  const { data, error } = await supabase.rpc('list_member_celebrations', { p_days: days });
  if (error) {
    if (isMissingFunction(error) || /not_linked|not_authenticated/i.test(String(error.message || ''))) return [];
    throw new Error('Could not load celebrations.');
  }
  const items = data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
    ? (data as { items: unknown[] }).items
    : [];
  return items.map(sanitizeCelebration).filter((c): c is Celebration => Boolean(c));
}

/** directoryId → { kind, label } for Directory labels. Empty map when not set up. */
export async function listAnniversaryKinds(): Promise<Map<string, { kind: AnniversaryKind; label: string | null }>> {
  const out = new Map<string, { kind: AnniversaryKind; label: string | null }>();
  if (!(await hasSession())) return out;
  const { data, error } = await supabase.rpc('list_member_anniversary_kinds');
  if (error || !Array.isArray(data)) return out;
  for (const row of data as unknown[]) {
    const o = (row || {}) as Record<string, unknown>;
    const id = asStr(o.directoryId);
    const kind = asKind(o.kind);
    if (id && kind) out.set(id, { kind, label: asStr(o.label) });
  }
  return out;
}

export async function getMyAnniversaryKind(): Promise<{ kind: AnniversaryKind | null; label: string | null; available: boolean }> {
  if (!(await hasSession())) return { kind: null, label: null, available: false };
  const { data, error } = await supabase.rpc('get_my_anniversary_kind');
  if (error) return { kind: null, label: null, available: !isMissingFunction(error) };
  const o = (data || {}) as Record<string, unknown>;
  return { kind: asKind(o.kind), label: asStr(o.label), available: true };
}

export async function updateMyAnniversaryKind(kind: AnniversaryKind | null, label: string | null): Promise<void> {
  const clean = kind === 'other' ? (label || '').replace(/\s+/g, ' ').trim().slice(0, ANNIVERSARY_LABEL_MAX) || null : null;
  const { error } = await supabase.rpc('update_my_anniversary_kind', { p_kind: kind, p_label: clean });
  if (error) {
    if (isMissingFunction(error)) throw new CelebrationsUnavailableError();
    if (/too_long/i.test(String(error.message || ''))) throw new Error(`Please keep the anniversary name under ${ANNIVERSARY_LABEL_MAX} letters.`);
    throw new Error('Your anniversary type could not be saved. Please try again.');
  }
}
