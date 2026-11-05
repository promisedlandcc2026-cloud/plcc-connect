import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { MemberHomeSection } from './MemberHomeSection';
import { LoadingState } from '../ui/States';

export const MemberHomeNotifications: React.FC = () => {
  const { notifications, unreadCount, loading, error } = useNotifications();
  const unread = notifications.filter((n) => !n.readAt).slice(0, 3);

  return (
    <MemberHomeSection
      title="🔔 Notifications"
      action={{ to: '/notifications', label: 'See all' }}
    >
      {loading && notifications.length === 0 ? (
        <LoadingState message="Checking notifications…" />
      ) : null}

      {!loading && error && notifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
          Notifications are temporarily unavailable.
        </div>
      ) : null}

      {!loading && !error && unreadCount === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white/80 px-4 py-5 text-center">
          <Bell size={18} className="mx-auto text-gray-500 mb-2" aria-hidden />
          <p className="text-sm text-gray-500">You&apos;re all caught up</p>
        </div>
      ) : null}

      {unreadCount > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 px-0.5">
            {unreadCount === 1 ? '1 unread notification' : `${unreadCount} unread notifications`}
          </p>
          {unread.map((item) => (
            <Link
              key={item.id}
              to={item.destination?.path || '/notifications'}
              className="block rounded-2xl border border-burgundy/15 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                {item.typeLabel}
              </p>
              <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">{item.title}</p>
              {item.message ? (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.message}</p>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </MemberHomeSection>
  );
};
