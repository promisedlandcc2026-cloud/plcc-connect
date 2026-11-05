/**
 * Family Huddle client types (Connect).
 */

export type FamilyHuddleErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'not_adult'
  | 'unlinked'
  | 'conflict'
  | 'empty'
  | 'invite_expired'
  | 'invite_locked'
  | 'invite_exhausted'
  | 'huddle_unavailable'
  | 'bridge_unconfigured'
  | 'vault_unavailable'
  | 'invalid_body'
  | 'session_missing'
  | 'network'
  | 'rate_limited';

export class FamilyHuddleError extends Error {
  code: FamilyHuddleErrorCode;
  status: number;
  soft: boolean;

  constructor(
    code: FamilyHuddleErrorCode,
    message: string,
    status = 0,
    soft = false
  ) {
    super(message);
    this.name = 'FamilyHuddleError';
    this.code = code;
    this.status = status;
    this.soft = soft;
  }
}

export type FamilyHuddleStatus = {
  configured: boolean;
  live: boolean;
  participantCount: number;
  householdName: string | null;
};

export type FamilyHuddleJoinToken = {
  token: string;
  url: string;
  roomName: string;
  expiresIn: number;
  canModerate: boolean;
  isGuest: boolean;
  displayName: string;
  householdName: string | null;
};

export type FamilyHuddleInvite = {
  code: string;
  path: string;
  expiresAt: string | null;
  maxUses: number;
  householdName: string | null;
};
