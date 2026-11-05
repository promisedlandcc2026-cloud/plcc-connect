/**
 * Phase 2.6D.2 — fail-closed sanitizer for get_my_guardian_child_cards() jsonb.
 * Drops unknown / PII / ID fields. No fake credential defaults. No I/O.
 */

import type { DependentCardStatus, GuardianDependentCard } from './dependentCardTypes';
import {
  DEPENDENT_DISPLAY_NAME_MAX,
  DEPENDENT_LABEL_MAX,
} from './dependentCardTypes';
import { isDependentCardRef } from './dependentCardRef';

export class DependentCardSanitizeError extends Error {
  code: 'dependent_card_data_invalid';
  constructor() {
    super('dependent_card_data_invalid');
    this.name = 'DependentCardSanitizeError';
    this.code = 'dependent_card_data_invalid';
  }
}

const CARD_NUMBER_RE = /^PLCC-[0-9]{4}-[0-9]{5,}$/;
const QR_PAYLOAD_RE = /^AWC1\.[0-9a-f]{64}$/;
const ACCESS_CODE_RE = /^[0-9]{4}$/;
const STATUS_SET = new Set<DependentCardStatus>(['active', 'inactive', 'revoked']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

function clampText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function isValidIsoTimestamp(value: string): boolean {
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

function parseStatus(value: unknown): DependentCardStatus {
  if (typeof value !== 'string') throw new DependentCardSanitizeError();
  const s = value.trim().toLowerCase();
  if (!STATUS_SET.has(s as DependentCardStatus)) throw new DependentCardSanitizeError();
  return s as DependentCardStatus;
}

function sanitizeOne(raw: unknown): GuardianDependentCard {
  const r = asRecord(raw);
  if (!r) throw new DependentCardSanitizeError();

  if (!isDependentCardRef(r.cardRef)) throw new DependentCardSanitizeError();
  const cardRef = r.cardRef;

  const cardNumber = asNullableString(r.cardNumber);
  if (!cardNumber || !CARD_NUMBER_RE.test(cardNumber)) throw new DependentCardSanitizeError();

  const qrPayload = asNullableString(r.qrPayload);
  if (!qrPayload || !QR_PAYLOAD_RE.test(qrPayload)) throw new DependentCardSanitizeError();

  const displayName = asNullableString(r.displayName);
  if (!displayName) throw new DependentCardSanitizeError();

  const labelRaw = asNullableString(r.label);
  const label = labelRaw ? clampText(labelRaw, DEPENDENT_LABEL_MAX) : 'PLCC Child Member';

  const issuedAt = asNullableString(r.issuedAt);
  if (!issuedAt || !isValidIsoTimestamp(issuedAt)) throw new DependentCardSanitizeError();

  let rotatedAt: string | null = null;
  if (r.rotatedAt != null) {
    const rot = asNullableString(r.rotatedAt);
    if (!rot || !isValidIsoTimestamp(rot)) throw new DependentCardSanitizeError();
    rotatedAt = rot;
  }

  // Optional desk code — invalid/missing becomes null (do not reject the whole card).
  let accessCode: string | null = null;
  if (r.accessCode != null) {
    const code = asNullableString(r.accessCode);
    if (code && ACCESS_CODE_RE.test(code)) accessCode = code;
  }

  // Explicit allow-list only — injected IDs / PII / flags / hashes are dropped.
  return {
    cardRef,
    displayName: clampText(displayName, DEPENDENT_DISPLAY_NAME_MAX),
    label,
    cardNumber,
    cardStatus: parseStatus(r.cardStatus),
    qrPayload,
    issuedAt,
    rotatedAt,
    accessCode,
  };
}

/**
 * Sanitize guardian child-card RPC payload.
 * Fail-closed on malformed shape, invalid formats, or duplicate cardRef.
 * Empty array is valid (no authorized dependents).
 */
export function sanitizeGuardianDependentCards(raw: unknown): GuardianDependentCard[] {
  if (!Array.isArray(raw)) throw new DependentCardSanitizeError();

  const out: GuardianDependentCard[] = [];
  const seenRefs = new Set<string>();

  for (const row of raw) {
    const card = sanitizeOne(row);
    if (seenRefs.has(card.cardRef)) throw new DependentCardSanitizeError();
    seenRefs.add(card.cardRef);
    out.push(card);
  }

  return out;
}
