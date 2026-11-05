/**
 * Phase 2.8B — Member Directory via authenticated Supabase RPCs only.
 * Server enforces opt-in + field privacy. No Vault proxy. No mention-candidates reuse.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export type DirectoryMember = {
  directoryId: string;
  displayName: string;
  sortKey: string;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  birthdayMd: string | null;
  anniversaryMd: string | null;
  householdName: string | null;
  ministries: string[];
};

export class DirectoryClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || directoryErrorMessage(code));
    this.name = 'DirectoryClientError';
    this.code = code;
  }
}

export function directoryErrorMessage(code: string): string {
  switch (code) {
    case 'unauthorized':
      return 'Please sign in again to continue.';
    case 'not_linked':
      return 'Your member profile must be linked before you can use the directory.';
    case 'query_too_short':
      return 'Type at least 2 letters to search.';
    case 'not_configured':
      return 'Directory is not available right now.';
    default:
      return 'We could not load the directory. Please try again.';
  }
}

function mapRpcError(error: { code?: string; message?: string } | null): never {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (/not_authenticated/i.test(message)) throw new DirectoryClientError('unauthorized');
  if (/not_linked/i.test(message)) throw new DirectoryClientError('not_linked');
  if (/query_too_short/i.test(message)) throw new DirectoryClientError('query_too_short');
  if (code === '42501' || /permission denied|JWT/i.test(message)) {
    throw new DirectoryClientError('unauthorized');
  }
  if (code === 'PGRST202' || /could not find.*function|schema cache/i.test(message)) {
    throw new DirectoryClientError(
      'directory_unavailable',
      'The directory isn’t available right now. Please try again later.'
    );
  }
  throw new DirectoryClientError('directory_unavailable');
}

async function requireSession(): Promise<void> {
  if (!isSupabaseConfigured) throw new DirectoryClientError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) throw new DirectoryClientError('unauthorized');
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function sanitizeItem(raw: unknown): DirectoryMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const displayName = asStr(o.displayName);
  const directoryId = asStr(o.directoryId);
  if (!displayName || !directoryId) return null;
  const ministries = Array.isArray(o.ministries)
    ? o.ministries.map((m) => String(m || '').trim()).filter(Boolean)
    : [];
  return {
    directoryId,
    displayName,
    sortKey: asStr(o.sortKey) || displayName.toLowerCase(),
    avatarUrl: asStr(o.avatarUrl),
    phone: asStr(o.phone),
    email: asStr(o.email),
    birthdayMd: asStr(o.birthdayMd),
    anniversaryMd: asStr(o.anniversaryMd),
    householdName: asStr(o.householdName),
    ministries,
  };
}

function sanitizeItems(data: unknown): DirectoryMember[] {
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const items = Array.isArray(o.items) ? o.items : [];
  return items.map(sanitizeItem).filter((x): x is DirectoryMember => Boolean(x));
}

export async function listMemberDirectory(opts?: {
  letter?: string | null;
  limit?: number;
  offset?: number;
}): Promise<DirectoryMember[]> {
  await requireSession();
  const letter = opts?.letter ? String(opts.letter).trim().slice(0, 1).toUpperCase() : null;
  const { data, error } = await supabase.rpc('list_member_directory', {
    p_letter: letter && /[A-Z]/.test(letter) ? letter : null,
    p_limit: opts?.limit ?? 50,
    p_offset: opts?.offset ?? 0,
  });
  if (error) mapRpcError(error);
  return sanitizeItems(data);
}

export async function searchMemberDirectory(
  query: string,
  limit = 30
): Promise<DirectoryMember[]> {
  await requireSession();
  const q = String(query || '').trim();
  if (q.length < 2) throw new DirectoryClientError('query_too_short');
  const { data, error } = await supabase.rpc('search_member_directory', {
    p_q: q.slice(0, 80),
    p_limit: limit,
  });
  if (error) mapRpcError(error);
  return sanitizeItems(data);
}

/** Format MM-DD for display without inventing a year. */
export function formatDirectoryMonthDay(md: string | null): string | null {
  if (!md) return null;
  const m = md.match(/^(\d{2})-(\d{2})$/);
  if (!m) return md;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!month || !day) return md;
  return new Date(2000, month - 1, day).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
