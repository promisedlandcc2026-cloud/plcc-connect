/**
 * Phase 2.6C.4A — pure Family UI helpers (no network, no storage).
 */

import type {
  FamilyCardAccess,
  FamilyClientErrorCode,
  FamilySummary,
  FamilySummaryState,
} from './familyTypes';

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'Self',
  spouse: 'Spouse',
  partner: 'Partner',
  parent: 'Parent',
  child: 'Child',
  dependent: 'Dependent',
  relative: 'Relative',
  guardian: 'Guardian',
  legal_guardian: 'Legal Guardian',
  authorized_guardian: 'Authorized Guardian',
  other: 'Other',
  // Server may already return title-cased guardian labels
  Parent: 'Parent',
  'Legal Guardian': 'Legal Guardian',
  'Authorized Guardian': 'Authorized Guardian',
};

/**
 * Map stored relationship strings to member-safe labels.
 * Does not imply legal custody beyond the stored operational label.
 */
export function familyRelationshipLabel(value: string | null | undefined): string {
  if (value == null) return 'Family member';
  const raw = String(value).trim();
  if (!raw) return 'Family member';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (RELATIONSHIP_LABELS[raw]) return RELATIONSHIP_LABELS[raw];
  if (RELATIONSHIP_LABELS[key]) return RELATIONSHIP_LABELS[key];
  // Conservative: title-case short safe tokens only
  if (/^[a-zA-Z][a-zA-Z _-]{0,40}$/.test(raw)) {
    return raw
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Family member';
}

/**
 * Card-access labels — never claim a child QR/card exists today.
 */
export function familyCardAccessLabel(access: FamilyCardAccess): string {
  switch (access) {
    case 'self':
      return 'Your card';
    case 'guardian':
      return 'Authorized for family card access';
    case 'none':
    default:
      return 'No card access';
  }
}

/**
 * UI summary state for future /family routing/copy.
 *
 * - linked=false → unlinked (valid product state, not an error)
 * - linked + householdState=conflict → household_conflict (even if self present)
 * - linked + no household + no adults + no dependents → empty_family
 *   (self alone still counts as empty_family for directory UI)
 * - otherwise → ready
 */
export function familySummaryState(summary: FamilySummary): FamilySummaryState {
  if (!summary.linked) return 'unlinked';
  if (summary.householdState === 'conflict') return 'household_conflict';
  const hasDirectory =
    summary.household != null ||
    summary.adults.length > 0 ||
    summary.dependents.length > 0;
  if (!hasDirectory) return 'empty_family';
  return 'ready';
}

export function familyErrorMessage(code: FamilyClientErrorCode | string | null | undefined): string {
  switch (String(code || '')) {
    case 'unauthorized':
      return 'Sign in to view your family.';
    case 'not_configured':
      return 'Family isn’t available right now.';
    case 'family_data_invalid':
      return 'We couldn’t safely display your family information.';
    case 'family_unavailable':
    default:
      return 'We couldn’t load your family right now.';
  }
}

export function familyUnlinkedCopy(): string {
  return 'PLCC staff can help connect your sign-in account to your member record.';
}

export function familyHouseholdConflictCopy(): string {
  return 'Please ask PLCC staff to review your family setup before Family features are used.';
}

export function familyEmptyCopy(): string {
  return 'No family members are connected yet.';
}
