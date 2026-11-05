/**
 * Phase 2.6C.4A — Family summary via authenticated Supabase RPC only.
 * Browser anon key + member session JWT. No elevated credentials or Vault proxy.
 * No raw relationship-table reads. Plain in-memory fetch (no browser storage).
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { FamilySummary } from './familyTypes';
import { FamilySanitizeError, sanitizeFamilySummary } from './familySanitize';
import { familyErrorMessage } from './familyUi';

export { sanitizeFamilySummary } from './familySanitize';

export class FamilyClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || familyErrorMessage(code));
    this.name = 'FamilyClientError';
    this.code = code;
  }
}

function mapRpcError(error: { code?: string; message?: string } | null): never {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (/not_authenticated/i.test(message)) {
    throw new FamilyClientError('unauthorized');
  }
  if (code === '42501' || /permission denied|JWT/i.test(message)) {
    throw new FamilyClientError('unauthorized');
  }
  if (code === 'PGRST202' || /could not find.*function|schema cache/i.test(message)) {
    throw new FamilyClientError('family_unavailable');
  }
  throw new FamilyClientError('family_unavailable');
}

async function requireSession(): Promise<void> {
  if (!isSupabaseConfigured) throw new FamilyClientError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new FamilyClientError('unauthorized');
  }
}

/**
 * Load the caller's member-safe Family summary.
 * No cross-user cache — fetch per call.
 */
export async function fetchMyFamilySummary(): Promise<FamilySummary> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_family_summary');
  if (error) mapRpcError(error);
  try {
    return sanitizeFamilySummary(data);
  } catch (e) {
    if (e instanceof FamilySanitizeError) {
      throw new FamilyClientError('family_data_invalid');
    }
    throw e;
  }
}
