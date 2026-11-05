/**
 * Phase 2.6B — member-safe digital card DTO (matches Vault RPC jsonb).
 */

export type MemberCardStatus = 'active' | 'inactive' | 'revoked';

export type MemberDigitalCard = {
  displayName: string;
  avatarUrl: string | null;
  label: string;
  cardNumber: string;
  cardStatus: MemberCardStatus;
  qrPayload: string;
  issuedAt: string;
  rotatedAt: string | null;
};
