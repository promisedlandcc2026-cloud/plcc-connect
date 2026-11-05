/**
 * Phase 2.6C.4A / 2.6D.2C — fail-closed Family summary JSON sanitizer (pure; no I/O).
 * Dependents require explicit cardRef; guardian↔AWCD and none↔null are fail-closed.
 */

import type {
  FamilyAdultSummary,
  FamilyDependentSummary,
  FamilyHouseholdSummary,
  FamilySelfSummary,
  FamilySummary,
} from './familyTypes';
import {
  FAMILY_AVATAR_URL_MAX,
  FAMILY_DISPLAY_NAME_MAX,
  FAMILY_RELATIONSHIP_MAX,
} from './familyTypes';
import { isDependentCardRef } from './dependentCardRef';

export class FamilySanitizeError extends Error {
  code: 'family_data_invalid';
  constructor() {
    super('family_data_invalid');
    this.name = 'FamilySanitizeError';
    this.code = 'family_data_invalid';
  }
}

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

function sanitizeAvatarUrl(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;
  if (raw.length > FAMILY_AVATAR_URL_MAX) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:') return raw;
    return null;
  } catch {
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    return null;
  }
}

function sanitizeDisplayName(value: unknown, fallback: string): string {
  const s = asNullableString(value);
  if (!s) return fallback;
  return clampText(s, FAMILY_DISPLAY_NAME_MAX);
}

function sanitizeRelationship(value: unknown): string | null {
  const s = asNullableString(value);
  if (!s) return null;
  return clampText(s, FAMILY_RELATIONSHIP_MAX);
}

function sanitizeHousehold(raw: unknown): FamilyHouseholdSummary | null {
  if (raw == null) return null;
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  const name = asNullableString(r.name);
  return {
    name: name ? clampText(name, FAMILY_DISPLAY_NAME_MAX) : null,
  };
}

function sanitizeSelf(raw: unknown): FamilySelfSummary {
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  if (r.cardAccess !== 'self') throw new FamilySanitizeError();
  return {
    displayName: sanitizeDisplayName(r.displayName, 'You'),
    avatarUrl: sanitizeAvatarUrl(r.avatarUrl),
    cardAccess: 'self',
  };
}

function sanitizeAdult(raw: unknown): FamilyAdultSummary {
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  if (r.cardAccess !== 'none') throw new FamilySanitizeError();
  return {
    displayName: sanitizeDisplayName(r.displayName, 'Family member'),
    avatarUrl: sanitizeAvatarUrl(r.avatarUrl),
    relationship: sanitizeRelationship(r.relationship),
    cardAccess: 'none',
  };
}

function sanitizeDependentCardRef(
  cardAccess: 'guardian' | 'none',
  raw: Record<string, unknown>
): string | null {
  // Live server always returns cardRef; missing property is a contract failure.
  if (!Object.prototype.hasOwnProperty.call(raw, 'cardRef')) {
    throw new FamilySanitizeError();
  }
  if (cardAccess === 'guardian') {
    if (!isDependentCardRef(raw.cardRef)) throw new FamilySanitizeError();
    return raw.cardRef;
  }
  // none: must be exact null — do not strip a leaked AWCD ref.
  if (raw.cardRef !== null) throw new FamilySanitizeError();
  return null;
}

function sanitizeDependent(raw: unknown): FamilyDependentSummary {
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  if (r.cardAccess !== 'guardian' && r.cardAccess !== 'none') {
    throw new FamilySanitizeError();
  }
  const cardRef = sanitizeDependentCardRef(r.cardAccess, r);
  return {
    displayName: sanitizeDisplayName(r.displayName, 'Dependent'),
    avatarUrl: null,
    relationship: sanitizeRelationship(r.relationship),
    cardAccess: r.cardAccess,
    cardRef,
  };
}

/**
 * Fail-closed parser for get_my_family_summary jsonb.
 * Drops unknown keys. Does NOT coerce malformed payloads to linked=false.
 */
export function sanitizeFamilySummary(raw: unknown): FamilySummary {
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  if (typeof r.linked !== 'boolean') throw new FamilySanitizeError();

  let householdState: FamilySummary['householdState'] = null;
  if (r.householdState === 'conflict') householdState = 'conflict';
  else if (r.householdState == null) householdState = null;
  else throw new FamilySanitizeError();

  if (!Array.isArray(r.adults) || !Array.isArray(r.dependents)) {
    throw new FamilySanitizeError();
  }

  const household = sanitizeHousehold(r.household);

  let self: FamilySelfSummary | null = null;
  if (r.linked) {
    if (r.self == null) throw new FamilySanitizeError();
    self = sanitizeSelf(r.self);
  } else {
    if (r.self != null) throw new FamilySanitizeError();
    if (r.household != null) throw new FamilySanitizeError();
    if (householdState !== null) throw new FamilySanitizeError();
    if (r.adults.length !== 0 || r.dependents.length !== 0) {
      throw new FamilySanitizeError();
    }
  }

  return {
    linked: r.linked,
    household: r.linked ? household : null,
    householdState: r.linked ? householdState : null,
    self,
    adults: r.linked ? r.adults.map(sanitizeAdult) : [],
    dependents: r.linked ? r.dependents.map(sanitizeDependent) : [],
  };
}
