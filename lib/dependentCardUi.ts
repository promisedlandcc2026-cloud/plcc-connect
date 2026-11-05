/**
 * Phase 2.6D.2 / 2.6D.3 — pure helpers for guardian child-card UI (no network, no storage).
 * No pickup/check-out claims. No credential logging.
 */

import type { DependentCardStatus } from './dependentCardTypes';

export function dependentCardStatusLabel(status: DependentCardStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'revoked':
      return 'Revoked';
    default:
      return 'Unavailable';
  }
}

export function dependentCardErrorMessage(code: string | null | undefined): string {
  switch (String(code || '')) {
    case 'unauthorized':
      return 'Sign in to view family member cards.';
    case 'not_configured':
      return 'Family member cards aren’t available right now.';
    case 'dependent_card_data_invalid':
      return 'We couldn’t safely display family member cards.';
    case 'dependent_cards_unavailable':
    default:
      return 'We couldn’t load family member cards right now.';
  }
}

/** Page-level load failure (RPC/service) — retryable. */
export function dependentCardPageLoadErrorMessage(): string {
  return 'We couldn’t load this child card right now.';
}

/**
 * Missing/unauthorized/malformed route ref — same message (no information oracle).
 */
export function dependentCardUnavailableMessage(): string {
  return 'This child card is not available.';
}

export function dependentCardCountLabel(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return 'No family member cards available';
  if (n === 1) return '1 family member card';
  return `${n} family member cards`;
}

/** Safe access subtitle — does not imply pickup/check-out authorization. */
export const DEPENDENT_CARD_ACCESS_COPY =
  'Available through your verified family access.';

/** Privacy reminder on child-card page. */
export const DEPENDENT_CARD_PRIVACY_COPY =
  'This membership card is available through your verified family access.';

/** Prominent disclaimer — staff may scan for Kids Kiosk custody; QR alone ≠ pickup. */
export const DEPENDENT_CARD_PICKUP_DISCLAIMER =
  'Staff may scan this card at Kids Check-In. The QR alone is not pickup authorization — an authorized guardian must be confirmed at the kiosk.';

/** Screenshot warning — does not imply guardian can rotate. */
export const DEPENDENT_CARD_SCREENSHOT_COPY =
  'Keep this QR private. A screenshot may remain usable until the credential is changed by PLCC.';
