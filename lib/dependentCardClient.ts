/**
 * Phase 2.6D.2 — guardian child cards via authenticated Supabase RPC only.
 * Browser anon key + member session JWT. No elevated credentials or Vault proxy.
 * No raw table reads. No browser storage of credentials. No guardian mutations.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { GuardianDependentCard } from './dependentCardTypes';
import {
  DependentCardSanitizeError,
  sanitizeGuardianDependentCards,
} from './dependentCardSanitize';
import { dependentCardErrorMessage } from './dependentCardUi';

export { sanitizeGuardianDependentCards } from './dependentCardSanitize';

export class DependentCardClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || dependentCardErrorMessage(code));
    this.name = 'DependentCardClientError';
    this.code = code;
  }
}

function mapRpcError(error: { code?: string; message?: string } | null): never {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (/not_authenticated/i.test(message)) {
    throw new DependentCardClientError('unauthorized');
  }
  if (code === '42501' || /permission denied|JWT/i.test(message)) {
    throw new DependentCardClientError('unauthorized');
  }
  if (code === 'PGRST202' || /could not find.*function|schema cache/i.test(message)) {
    throw new DependentCardClientError('dependent_cards_unavailable');
  }
  throw new DependentCardClientError('dependent_cards_unavailable');
}

async function requireSession(): Promise<void> {
  if (!isSupabaseConfigured) throw new DependentCardClientError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new DependentCardClientError('unauthorized');
  }
}

/**
 * Load (and lazy-mint if needed) guardian-authorized dependent cards.
 * Empty array = no currently authorized dependents (valid product state).
 */
export async function fetchMyGuardianDependentCards(): Promise<GuardianDependentCard[]> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_guardian_child_cards');
  if (error) mapRpcError(error);
  try {
    return sanitizeGuardianDependentCards(data);
  } catch (e) {
    if (e instanceof DependentCardSanitizeError) {
      throw new DependentCardClientError('dependent_card_data_invalid');
    }
    throw e;
  }
}
