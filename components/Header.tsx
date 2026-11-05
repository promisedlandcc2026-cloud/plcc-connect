import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, UserRound, Users } from 'lucide-react';
import { AWCLogo } from './ui/AWCLogo';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { canLoadNotificationInbox } from '../lib/memberNotificationsTypes';
import {
  prefetchAccountChunk,
  prefetchCommunityChunks,
  prefetchNotificationsChunk,
} from '../lib/prefetchMemberChunks';

export const Header: React.FC = () => {
  const { isAuthenticated, isLoading, memberAccessState } = useAuth();
  const { unreadBadge } = useNotifications();
  const isApproved = !isLoading && isAuthenticated && memberAccessState === 'approved_member';
  const showBell = !isLoading && canLoadNotificationInbox(isAuthenticated, memberAccessState);

  return (
    <header className="pt-4 pb-6 px-5 text-center">
      {/* Own row above the logo — never absolutely overlaid on the emblem */}
      <div className="mb-3 flex min-h-[44px] items-center justify-end gap-1.5">
        {showBell && (
          <Link
            to="/notifications"
            className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full bg-white border border-gray-100 shadow-sm text-burgundy hover:bg-gray-50 transition-colors"
            aria-label={
              unreadBadge
                ? `Notifications, ${unreadBadge} unread`
                : 'Notifications'
            }
            onFocus={() => prefetchNotificationsChunk()}
            onMouseEnter={() => prefetchNotificationsChunk()}
            onTouchStart={() => prefetchNotificationsChunk()}
          >
            <Bell size={18} aria-hidden />
            {unreadBadge && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-burgundy text-white text-[11px] font-black leading-5">
                {unreadBadge}
              </span>
            )}
          </Link>
        )}
        {isApproved && (
          <Link
            to="/community"
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-full bg-burgundy text-white shadow-sm hover:bg-burgundy-dark transition-colors"
            aria-label="Open Community"
            onFocus={() => prefetchCommunityChunks()}
            onMouseEnter={() => prefetchCommunityChunks()}
            onTouchStart={() => prefetchCommunityChunks()}
          >
            <Users size={18} aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
              Community
            </span>
          </Link>
        )}
        {!isLoading && (
          <Link
            to={isAuthenticated ? '/account' : '/sign-in'}
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-full bg-white border border-gray-100 shadow-sm text-burgundy hover:bg-gray-50 transition-colors"
            aria-label={isAuthenticated ? 'Open account' : 'Member sign in'}
            onFocus={() => {
              if (isAuthenticated) prefetchAccountChunk();
            }}
            onMouseEnter={() => {
              if (isAuthenticated) prefetchAccountChunk();
            }}
          >
            <UserRound size={18} aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
              {isAuthenticated ? 'Account' : 'Sign in'}
            </span>
          </Link>
        )}
      </div>

      <div className="flex justify-center mb-5">
        <AWCLogo size={140} className="drop-shadow-md" />
      </div>
      <p className="text-burgundy font-semibold italic text-sm mb-3 uppercase tracking-wide">
        “Changing Hearts. Transforming Lives.”
      </p>

      <a
        href="https://sanctum-live-nine.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-full bg-white text-xs font-bold text-burgundy uppercase tracking-widest hover:bg-gray-50 transition-colors mb-4 border border-gray-100 shadow-sm"
      >
        Visit Website
      </a>

      <p className="text-gray-500 text-xs uppercase tracking-[0.2em] font-bold">
        We’re glad you’re here
      </p>
    </header>
  );
};
