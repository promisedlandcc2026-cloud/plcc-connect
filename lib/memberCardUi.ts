/**
 * Phase 2.6B — pure helpers for My PLCC Card UI (no secrets, no logging of tokens).
 */

import type { MemberCardStatus } from './memberCardTypes';

const QR_TOKEN_RE = /^AWC1\.[0-9a-f]{64}$/;
const CARD_NUMBER_RE = /^PLCC-[0-9]{4}-[0-9]{5,}$/;

export function isValidQrPayload(value: unknown): value is string {
  return typeof value === 'string' && QR_TOKEN_RE.test(value);
}

export function isValidCardNumber(value: unknown): value is string {
  return typeof value === 'string' && CARD_NUMBER_RE.test(value);
}

export function parseCardStatus(value: unknown): MemberCardStatus {
  const s = String(value || '').toLowerCase();
  if (s === 'inactive' || s === 'revoked' || s === 'active') return s;
  return 'inactive';
}

export function cardStatusLabel(status: MemberCardStatus): string {
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

/** Initials for avatar fallback — never derived from email matching. */
export function cardInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function mapMemberCardError(code: string | null | undefined): string {
  switch (String(code || '')) {
    case 'not_authenticated':
      return 'Sign in to view your PLCC card.';
    case 'not_configured':
      return 'Your card isn’t available right now.';
    case 'not_approved':
      return 'Your PLCC card isn’t available until your membership is approved.';
    case 'card_revoked':
      return 'This card has been revoked. Contact the church office if you need help.';
    case 'card_not_found':
      return 'Your card isn’t available right now.';
    case 'forbidden':
      return 'You can only access your own PLCC card.';
    case 'schema_missing':
      return 'Your card isn’t available right now.';
    default:
      return 'We couldn’t load your PLCC card.';
  }
}

export function mapMemberCardRotateError(code: string | null | undefined): string {
  switch (String(code || '')) {
    case 'not_approved':
      return 'Your PLCC card isn’t available until your membership is approved.';
    case 'card_revoked':
      return 'This card has been revoked. Contact the church office if you need help.';
    case 'card_not_found':
      return 'We couldn’t regenerate your QR code.';
    default:
      return 'We couldn’t regenerate your QR code.';
  }
}

export const CARD_PRIVACY_COPY =
  'Your QR code is your digital PLCC membership credential. Keep it private and regenerate it if you think someone copied it.';

export const CARD_SCREENSHOT_COPY =
  'If you shared a screenshot of this QR by mistake, use Regenerate QR.';

export const ROTATE_CONFIRM_COPY =
  'Regenerate your QR code? Your current QR code will stop working immediately.';
