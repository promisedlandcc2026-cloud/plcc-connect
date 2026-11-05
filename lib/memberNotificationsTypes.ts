export type ConnectNotificationDestination = {
  path: string;
  label: string;
  kind: string;
  postId?: string;
  commentId?: string;
};

export type ConnectNotification = {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  sourceId: string | null;
  destination: ConnectNotificationDestination | null;
};

export type MemberNotificationsInbox = {
  notifications: ConnectNotification[];
  unreadCount: number;
  hasMore: boolean;
  skipped: number;
};

export type MemberNotificationsErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'vault_unavailable'
  | 'bridge_unconfigured'
  | 'invalid_upstream'
  | 'invalid_query'
  | 'invalid_body'
  | 'method_not_allowed'
  | 'network'
  | 'malformed_response'
  | 'session_missing'
  | 'not_approved';

export class MemberNotificationsError extends Error {
  code: MemberNotificationsErrorCode;
  status: number;
  sessionInvalid: boolean;

  constructor(
    code: MemberNotificationsErrorCode,
    message: string,
    status: number,
    sessionInvalid = false
  ) {
    super(message);
    this.name = 'MemberNotificationsError';
    this.code = code;
    this.status = status;
    this.sessionInvalid = sessionInvalid;
  }
}

/** Display helper — caps badge at 99+. Kept tiny for the public shell. */
export function formatUnreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 99) return '99+';
  return String(Math.floor(count));
}

/** Inbox + bell for any signed-in Connect user, including pending / phone-only. */
export function canLoadNotificationInbox(
  isAuthenticated: boolean,
  memberAccessState: string | null | undefined
): boolean {
  if (!isAuthenticated) return false;
  return memberAccessState === 'approved_member' || memberAccessState === 'pending';
}
