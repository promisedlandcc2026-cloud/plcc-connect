import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  canLoadNotificationInbox,
  formatUnreadBadge,
  MemberNotificationsError,
  type ConnectNotification,
} from '../lib/memberNotificationsTypes';

type NotificationsContextValue = {
  notifications: ConnectNotification[];
  unreadCount: number;
  unreadBadge: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  errorCode: string | null;
  skippedHint: boolean;
  refresh: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Load the notifications API client only when a signed-in member needs it. */
async function loadNotificationsClient() {
  return import('../lib/memberNotificationsClient');
}

const POLL_MS = 45_000;

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, memberAccessState, user } = useAuth();
  const authUserId = user?.id || null;

  const [notifications, setNotifications] = useState<ConnectNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [skippedHint, setSkippedHint] = useState(false);

  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    hasLoadedRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setError(null);
    setErrorCode(null);
    setSkippedHint(false);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const inboxEnabled = canLoadNotificationInbox(isAuthenticated, memberAccessState);

  const refresh = useCallback(async () => {
    if (!inboxEnabled) {
      clear();
      return;
    }
    if (inFlightRef.current) return;

    const requestId = ++requestIdRef.current;
    const uid = authUserId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;

    if (!hasLoadedRef.current) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setErrorCode(null);

    try {
      const { fetchMemberNotifications } = await loadNotificationsClient();
      const inbox = await fetchMemberNotifications({ signal: controller.signal });
      if (requestId !== requestIdRef.current) return;
      if (uid !== authUserId) return;
      setNotifications(inbox.notifications);
      setUnreadCount(inbox.unreadCount);
      setSkippedHint(inbox.skipped > 0);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      if (err instanceof MemberNotificationsError) {
        setError(err.message);
        setErrorCode(err.code);
      } else {
        setError('Notifications are temporarily unavailable. Please try again.');
        setErrorCode('vault_unavailable');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [authUserId, clear, inboxEnabled]);

  const markOneRead = useCallback(
    async (id: string) => {
      if (!inboxEnabled) return;

      const target = notifications.find((n) => n.id === id);
      if (!target || target.readAt) return;

      const previous = notifications;
      const previousUnread = unreadCount;
      const now = new Date().toISOString();

      setNotifications((list) =>
        list.map((n) => (n.id === id ? { ...n, readAt: now } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        const { markNotificationRead } = await loadNotificationsClient();
        const result = await markNotificationRead(id);
        setNotifications((list) =>
          list.map((n) =>
            n.id === id ? { ...n, readAt: result.readAt || now } : n
          )
        );
      } catch {
        setNotifications(previous);
        setUnreadCount(previousUnread);
        throw new MemberNotificationsError(
          'vault_unavailable',
          'We could not mark that notification as read. Please try again.',
          502
        );
      }
    },
    [inboxEnabled, notifications, unreadCount]
  );

  const markAllRead = useCallback(async () => {
    if (!inboxEnabled) return;
    if (unreadCount <= 0) return;

    const previous = notifications;
    const previousUnread = unreadCount;
    const now = new Date().toISOString();

    setNotifications((list) =>
      list.map((n) => (n.readAt ? n : { ...n, readAt: now }))
    );
    setUnreadCount(0);

    try {
      const { markAllNotificationsRead } = await loadNotificationsClient();
      await markAllNotificationsRead();
    } catch {
      setNotifications(previous);
      setUnreadCount(previousUnread);
      throw new MemberNotificationsError(
        'vault_unavailable',
        'We could not mark all notifications as read. Please try again.',
        502
      );
    }
  }, [inboxEnabled, notifications, unreadCount]);

  // Clear on sign-out; load for approved and pending (phone-only) sessions.
  useEffect(() => {
    if (!inboxEnabled || !authUserId) {
      clear();
      return;
    }
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity + eligibility only
  }, [authUserId, inboxEnabled]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      unreadBadge: formatUnreadBadge(unreadCount),
      loading,
      refreshing,
      error,
      errorCode,
      skippedHint,
      refresh,
      markOneRead,
      markAllRead,
      clear,
    }),
    [
      notifications,
      unreadCount,
      loading,
      refreshing,
      error,
      errorCode,
      skippedHint,
      refresh,
      markOneRead,
      markAllRead,
      clear,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
