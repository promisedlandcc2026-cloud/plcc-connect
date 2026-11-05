/**
 * Phase 2.6C.4A / 2.6D.2C — Connect Family client DTO types.
 * Narrow member-safe surface only. No raw IDs, credentials, or check-in flags.
 * Dependents may carry opaque cardRef (AWCD) when cardAccess=guardian — never QR/cardNumber.
 */

export type FamilyCardAccessSelf = 'self';
export type FamilyCardAccessNone = 'none';
export type FamilyCardAccessGuardian = 'guardian';

export type FamilyCardAccess =
  | FamilyCardAccessSelf
  | FamilyCardAccessNone
  | FamilyCardAccessGuardian;

export type FamilyHouseholdState = null | 'conflict';

export type FamilySummaryState =
  | 'unlinked'
  | 'ready'
  | 'household_conflict'
  | 'empty_family';

export type FamilyClientErrorCode =
  | 'unauthorized'
  | 'family_unavailable'
  | 'family_data_invalid'
  | 'not_configured';

export interface FamilyHouseholdSummary {
  name: string | null;
}

export interface FamilySelfSummary {
  displayName: string;
  avatarUrl: string | null;
  cardAccess: FamilyCardAccessSelf;
}

export interface FamilyAdultSummary {
  displayName: string;
  avatarUrl: string | null;
  relationship: string | null;
  cardAccess: FamilyCardAccessNone;
}

export interface FamilyDependentSummary {
  displayName: string;
  avatarUrl: null;
  relationship: string | null;
  cardAccess: FamilyCardAccessGuardian | FamilyCardAccessNone;
  /** Opaque AWCD join key when cardAccess=guardian; must be null when none. */
  cardRef: string | null;
}

export interface FamilySummary {
  linked: boolean;
  household: FamilyHouseholdSummary | null;
  householdState: FamilyHouseholdState;
  self: FamilySelfSummary | null;
  adults: FamilyAdultSummary[];
  dependents: FamilyDependentSummary[];
}

/** Display-name / relationship text bounds (sanitizer). */
export const FAMILY_DISPLAY_NAME_MAX = 120;
export const FAMILY_RELATIONSHIP_MAX = 80;
export const FAMILY_AVATAR_URL_MAX = 2048;
