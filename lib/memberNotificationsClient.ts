import { isSupabaseConfigured, supabase } from './supabase';
import {
  MemberNotificationsError,
  type ConnectNotification,
  type MemberNotificationsErrorCode,
  type MemberNotificationsInbox,
} from './memberNotificationsTypes';

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[member-notifications client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function mapStatus(status: number): { code: MemberNotificationsErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      message: 'Notifications are not available for this account yet.',
    };
  }
  if (status === 404) {
    return {
      code: 'not_found',
      message: 'That notification could not be found.',
    };
  }
  if (status === 429) {
    return {
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    };
  }
  if (status === 503) {
    return {
      code: 'bridge_unconfigured',
      message: 'Notifications are not available right now. Please try again later.',
    };
  }
  return {
    code: 'vault_unavailable',
    message: 'Notifications are temporarily unavailable. Please try again.',
  };
}

function parseInbox(body: unknown): MemberNotificationsInbox | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.notifications)) return null;
  return {
    notifications: b.notifications as ConnectNotification[],
    unreadCount: typeof b.unreadCount === 'number' ? b.unreadCount : 0,
    hasMore: Boolean(b.hasMore),
    skipped: typeof b.skipped === 'number' ? b.skipped : 0,
  };
}

async function authorizedFetch(
  init: RequestInit & { signal?: AbortSignal }
): Promise<{ res: Response; body: unknown }> {
  const token = await getAccessToken();
  if (!token) {
    throw new MemberNotificationsError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  let res: Response;
  try {
    res = await fetch('/api/member-notifications', {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new MemberNotificationsError(
      'network',
      'Notifications are temporarily unavailable. Please try again.',
      0
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new MemberNotificationsError(
      'unauthorized',
      'Please sign in again to continue.',
      401,
      !again
    );
  }

  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new MemberNotificationsError(mapped.code, mapped.message, res.status);
  }

  return { res, body };
}

export async function fetchMemberNotifications(opts?: {
  signal?: AbortSignal;
}): Promise<MemberNotificationsInbox> {
  const { body, res } = await authorizedFetch({
    method: 'GET',
    signal: opts?.signal,
  });

  const inbox = parseInbox(body);
  if (!inbox) {
    throw new MemberNotificationsError(
      'malformed_response',
      'Notifications are temporarily unavailable. Please try again.',
      res.status || 502
    );
  }
  return inbox;
}

export async function markNotificationRead(
  notificationId: string,
  opts?: { signal?: AbortSignal }
): Promise<{ id: string; readAt: string | null }> {
  const { body } = await authorizedFetch({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_read', notificationId }),
    signal: opts?.signal,
  });

  if (!body || typeof body !== 'object') {
    throw new MemberNotificationsError(
      'malformed_response',
      'Notifications are temporarily unavailable. Please try again.',
      502
    );
  }
  const b = body as Record<string, unknown>;
  const n = b.notification as { id?: string; readAt?: string | null } | undefined;
  return {
    id: n?.id || notificationId,
    readAt: n?.readAt ?? new Date().toISOString(),
  };
}

export async function markAllNotificationsRead(opts?: {
  signal?: AbortSignal;
}): Promise<void> {
  await authorizedFetch({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_all_read' }),
    signal: opts?.signal,
  });
}

/** Display helper — caps badge at 99+. */
export { formatUnreadBadge } from './memberNotificationsTypes';
