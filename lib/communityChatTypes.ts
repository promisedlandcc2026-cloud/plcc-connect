export type CommunityChatChannel = {
  id: string;
  name: string;
  description: string | null;
  visibility: string | null;
  type: string | null;
  /** Present when Vault returns a ministry-scoped channel the member can already access. */
  ministryId: string | null;
};

export type ChatDirectoryMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CommunityChatAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CommunityChatParent = {
  id: string;
  name: string;
  content: string | null;
  isDeleted: boolean;
};

export type CommunityChatMessage = {
  id: string;
  channelId: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  author: CommunityChatAuthor;
  parent: CommunityChatParent | null;
};

/** LIVE presence for a channel (Connect-sanitized). */
export type HuddleChannelStatus = {
  live: boolean;
  participantCount: number;
};

/** Match Vault: a huddle is visible as LIVE only when someone is in the room. */
export function isHuddleChannelLive(status: unknown): status is HuddleChannelStatus {
  if (!status || typeof status !== 'object') return false;
  const s = status as { live?: unknown; participantCount?: unknown };
  return Boolean(s.live) && Number(s.participantCount) > 0;
}

/** Vault-minted LiveKit join payload (no secrets). */
export type HuddleJoinToken = {
  token: string;
  url: string;
  roomName: string;
  expiresIn: number;
  canModerate: boolean;
  channelId: string;
  channelName: string;
  /** Vault-signed 12h permission to reopen this huddle while Supabase is down. */
  fallbackPass?: string;
  /** True when this token came from the saved permission (database down). */
  fallback?: boolean;
};

export type CommunityChatErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'bridge_unconfigured'
  | 'vault_unavailable'
  | 'huddle_unavailable'
  | 'invalid_upstream'
  | 'invalid_body'
  | 'session_missing'
  | 'network'
  | 'fallback_expired'
  | 'backup_line_unconfigured'
  | 'backup_line_unavailable'
  | 'huddle_line_busy'
  | 'huddle_not_started';

export class CommunityChatError extends Error {
  code: CommunityChatErrorCode;
  status: number;
  sessionInvalid: boolean;

  constructor(
    code: CommunityChatErrorCode,
    message: string,
    status: number,
    sessionInvalid = false
  ) {
    super(message);
    this.name = 'CommunityChatError';
    this.code = code;
    this.status = status;
    this.sessionInvalid = sessionInvalid;
  }
}

export function isDmChannel(channel: Pick<CommunityChatChannel, 'visibility' | 'name'>): boolean {
  const v = String(channel.visibility || '').toLowerCase();
  return v === 'dm' || String(channel.name || '').startsWith('DM_');
}
