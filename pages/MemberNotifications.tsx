import { MemberPageHeader } from '../components/member/MemberPageHeader';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck, Heart, Loader2, MessageCircle, RefreshCcw, Users, Cake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  MemberNotificationsError,
  type ConnectNotification,
} from '../lib/memberNotificationsTypes';
import { Button } from '../components/ui/Button';
import BirthdayCard from '../components/BirthdayCard';

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function NotificationIcon({ type }: { type: string }) {
  if (type.startsWith('community_feed') || type.startsWith('community_')) {
    return <Users size={16} className="text-burgundy" aria-hidden />;
  }
  if (type === 'prayer') {
    return <Heart size={16} className="text-burgundy" aria-hidden />;
  }
  if (type === 'celebration') {
    return <Cake size={16} className="text-burgundy" aria-hidden />;
  }
  if (type === 'announcement' || type === 'vault_news') {
    return <Bell size={16} className="text-burgundy" aria-hidden />;
  }
  return <MessageCircle size={16} className="text-burgundy" aria-hidden />;
}

const NotificationCard: React.FC<{
  item: ConnectNotification;
  busyId: string | null;
  onOpen: (item: ConnectNotification) => void;
}> = ({ item, busyId, onOpen }) => {
  const unread = !item.readAt;
  const busy = busyId === item.id;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      disabled={busy}
      className={`w-full text-left rounded-3xl border p-4 space-y-2 transition-colors ${
        unread
          ? 'bg-white border-burgundy/20 shadow-sm'
          : 'bg-white/70 border-gray-100'
      } ${busy ? 'opacity-70' : 'active:scale-[0.99]'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            unread ? 'bg-burgundy/10' : 'bg-gray-50'
          }`}
        >
          <NotificationIcon type={item.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">
              {item.typeLabel}
            </span>
            {unread && (
              <span className="inline-flex items-center text-xs font-bold text-burgundy">
                New
              </span>
            )}
          </div>
          <h2 className={`text-sm mt-0.5 ${unread ? 'font-bold text-[#1A1A1A]' : 'font-semibold text-gray-700'}`}>
            {item.title}
          </h2>
          {item.message ? (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words mt-1">
              {item.message}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-xs text-gray-500">{formatRelativeTime(item.createdAt)}</p>
            {item.destination ? (
              <span className="text-xs font-semibold text-burgundy">
                {item.destination.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
};

/**
 * Signed-in Notifications inbox — in-app only, no push.
 * Pending / phone-only accounts receive Vault News here too.
 */
export const MemberNotificationsPage: React.FC = () => {
  const { identity, memberAccessState } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    unreadBadge,
    loading,
    refreshing,
    error,
    errorCode,
    skippedHint,
    refresh,
    markOneRead,
    markAllRead,
  } = useNotifications();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [card, setCard] = useState<ConnectNotification | null>(null);

  // Birthday phone alert opens /notifications?open=celebration → show the newest greeting card.
  const [params, setParams] = useSearchParams();
  const openedFromAlert = useRef(false);
  useEffect(() => {
    if (openedFromAlert.current || params.get('open') !== 'celebration' || loading) return;
    const latest = notifications.find((n) => n.type === 'celebration');
    if (!latest) return;
    openedFromAlert.current = true;
    setCard(latest);
    setParams({}, { replace: true });
    if (!latest.readAt) void markOneRead(latest.id).catch(() => undefined);
  }, [params, setParams, notifications, loading, markOneRead]);

  const handleOpen = async (item: ConnectNotification) => {
    setActionError(null);
    if (!item.readAt) {
      setBusyId(item.id);
      try {
        await markOneRead(item.id);
      } catch (err) {
        setActionError(
          err instanceof MemberNotificationsError
            ? err.message
            : 'We could not update that notification. Please try again.'
        );
        setBusyId(null);
        return;
      }
      setBusyId(null);
    }
    // Birthday / anniversary from the Pastor opens as a card with the church header and seal.
    if (item.type === 'celebration') {
      setCard(item);
      return;
    }
    if (item.destination?.path) {
      const fromNotifications = item.destination.kind === 'community_post';
      navigate(item.destination.path, {
        state: fromNotifications ? { fromNotifications: true } : undefined,
      });
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount <= 0 || markingAll) return;
    setActionError(null);
    setMarkingAll(true);
    try {
      await markAllRead();
    } catch (err) {
      setActionError(
        err instanceof MemberNotificationsError
          ? err.message
          : 'We could not mark all as read. Please try again.'
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="Notifications"
        subtitle={
          unreadBadge
            ? `You have ${unreadBadge} unread ${unreadCount === 1 ? 'update' : 'updates'}.`
            : 'You’re all caught up.'
        }
        action={
          <Button
            variant="subtle"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
            aria-label="Refresh notifications"
          >
            {refreshing ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCcw size={16} aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleMarkAll()}
            disabled={markingAll || loading}
          >
            {markingAll ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <CheckCheck size={16} aria-hidden />
            )}
            Mark all as read
          </Button>
        </div>
      )}

      {(error || actionError) && (
        <div
          className="mb-4 rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-900 text-left"
          role="alert"
        >
          {actionError || error}
          {errorCode === 'unauthorized' && (
            <Link to="/sign-in" className="block mt-2 font-bold text-burgundy">
              Sign in again
            </Link>
          )}
        </div>
      )}

      {memberAccessState === 'pending' && (
        <p className="mb-4 text-sm text-gray-600 leading-relaxed">
          You’re signed in. Church Vault News still reaches this inbox while your member profile
          finishes setup.
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500" role="status">
          <Loader2 className="animate-spin" size={22} aria-hidden />
          Loading your notifications…
        </div>
      )}

      {!loading && notifications.length === 0 && !error && (
        <div className="rounded-3xl bg-white border border-gray-100 p-8 text-center space-y-2">
          <Bell className="mx-auto text-gray-500" size={28} aria-hidden />
          <h2 className="text-lg font-bold text-[#1A1A1A]">No notifications yet</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            When someone mentions you in Community or shares an update, it will show up here.
          </p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              busyId={busyId}
              onOpen={(n) => void handleOpen(n)}
            />
          ))}
          <p className="text-center text-xs text-gray-500 pt-2">
            Showing your most recent notifications.
          </p>
          {skippedHint && (
            <p className="text-center text-xs text-gray-500">
              A few items could not be shown and were skipped.
            </p>
          )}
        </div>
      )}
      {card && <BirthdayCard title={card.title} body={card.message} onClose={() => setCard(null)} />}
    </main>
  );
};
