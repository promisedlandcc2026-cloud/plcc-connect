/**
 * Phase 2.6B — My PLCC Card via authenticated Supabase RPCs.
 * Uses anon key + member JWT only. Never elevated server credentials.
 * Never client-minted tokens or card numbers.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { MemberDigitalCard } from './memberCardTypes';
import {
  isValidCardNumber,
  isValidQrPayload,
  mapMemberCardError,
  mapMemberCardRotateError,
  parseCardStatus,
} from './memberCardUi';

export class MemberCardClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || mapMemberCardError(code));
    this.name = 'MemberCardClientError';
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/** Sanitize RPC jsonb — keep only member-safe fields. */
export function sanitizeMemberCardDto(raw: unknown): MemberDigitalCard | null {
  const r = asRecord(raw);
  const cardNumber = asNullableString(r.cardNumber);
  const qrPayload = asNullableString(r.qrPayload);
  if (!cardNumber || !isValidCardNumber(cardNumber)) return null;
  if (!qrPayload || !isValidQrPayload(qrPayload)) return null;

  const displayName = asNullableString(r.displayName) || 'PLCC Member';
  const avatarRaw = asNullableString(r.avatarUrl);
  let avatarUrl: string | null = null;
  if (avatarRaw) {
    try {
      const u = new URL(avatarRaw);
      if (u.protocol === 'https:' || u.protocol === 'http:') avatarUrl = avatarRaw;
    } catch {
      if (avatarRaw.startsWith('/') && !avatarRaw.startsWith('//')) avatarUrl = avatarRaw;
    }
  }

  const issuedAt = asNullableString(r.issuedAt);
  if (!issuedAt) return null;

  return {
    displayName,
    avatarUrl,
    label: asNullableString(r.label) || 'PLCC Member',
    cardNumber,
    cardStatus: parseCardStatus(r.cardStatus),
    qrPayload,
    issuedAt,
    rotatedAt: asNullableString(r.rotatedAt),
  };
}

function mapRpcError(error: { code?: string; message?: string } | null): never {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (/not_authenticated/i.test(message)) throw new MemberCardClientError('not_authenticated');
  if (/not_approved/i.test(message)) throw new MemberCardClientError('not_approved');
  if (/user_not_linked/i.test(message)) throw new MemberCardClientError('not_approved');
  if (/card_revoked/i.test(message)) throw new MemberCardClientError('card_revoked');
  if (/card_not_found/i.test(message)) throw new MemberCardClientError('card_not_found');
  if (/card_mint_failed/i.test(message)) throw new MemberCardClientError('unavailable');
  if (code === '42501' || /permission denied|rls/i.test(message)) {
    throw new MemberCardClientError('forbidden');
  }
  if (code === 'PGRST202' || /could not find.*function|schema cache/i.test(message)) {
    throw new MemberCardClientError('schema_missing');
  }
  throw new MemberCardClientError('unavailable');
}

async function requireSession(): Promise<void> {
  if (!isSupabaseConfigured) throw new MemberCardClientError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) throw new MemberCardClientError('not_authenticated');
}

/**
 * Load (and lazy-mint if needed) the caller's digital card via get_my_member_digital_card.
 * get_my already mint-on-missing for approved members — no separate mint required for first open.
 */
export async function fetchMyDigitalCard(): Promise<MemberDigitalCard> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_member_digital_card');
  if (error) mapRpcError(error);
  const card = sanitizeMemberCardDto(data);
  if (!card) throw new MemberCardClientError('unavailable');
  return card;
}

/** Explicit mint alias — same RPC contract as get_my (idempotent). */
export async function ensureMyDigitalCard(): Promise<MemberDigitalCard> {
  await requireSession();
  const { data, error } = await supabase.rpc('mint_member_digital_card');
  if (error) mapRpcError(error);
  const card = sanitizeMemberCardDto(data);
  if (!card) throw new MemberCardClientError('unavailable');
  return card;
}

export async function rotateMyDigitalCard(): Promise<MemberDigitalCard> {
  await requireSession();
  const { data, error } = await supabase.rpc('rotate_member_digital_card');
  if (error) {
    const message = String(error.message || '');
    if (/not_approved/i.test(message)) {
      throw new MemberCardClientError('not_approved', mapMemberCardRotateError('not_approved'));
    }
    if (/card_revoked/i.test(message)) {
      throw new MemberCardClientError('card_revoked', mapMemberCardRotateError('card_revoked'));
    }
    if (/card_not_found/i.test(message)) {
      throw new MemberCardClientError('card_not_found', mapMemberCardRotateError('card_not_found'));
    }
    throw new MemberCardClientError('unavailable', mapMemberCardRotateError('unavailable'));
  }
  const card = sanitizeMemberCardDto(data);
  if (!card) throw new MemberCardClientError('unavailable', mapMemberCardRotateError('unavailable'));
  return card;
}
