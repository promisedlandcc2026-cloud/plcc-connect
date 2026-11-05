/**
 * Phase 2.6D.2 — guardian-visible dependent card DTO (matches Vault RPC jsonb).
 * Credential fields are opaque; no raw member/guardian/household IDs.
 */

export type DependentCardStatus = 'active' | 'inactive' | 'revoked';

export type GuardianDependentCard = {
  cardRef: string;
  displayName: string;
  label: string;
  cardNumber: string;
  cardStatus: DependentCardStatus;
  qrPayload: string;
  issuedAt: string;
  rotatedAt: string | null;
  /** Desk/kiosk 4-digit members.access_code when present; null if missing. */
  accessCode: string | null;
};

export type DependentCardClientErrorCode =
  | 'unauthorized'
  | 'dependent_cards_unavailable'
  | 'dependent_card_data_invalid'
  | 'not_configured';

/** Display-name clamp — plain text only. */
export const DEPENDENT_DISPLAY_NAME_MAX = 120;

/** Label clamp — plain text only. */
export const DEPENDENT_LABEL_MAX = 80;
