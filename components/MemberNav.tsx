import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar,
  HandHeart,
  Home,
  LayoutGrid,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { useHuddleLive } from '../context/HuddleLiveContext';
import { HuddleLiveDot } from './huddle/HuddleLiveDot';
import { AppsSheet } from './AppsSheet';
import { showDock, useDockHidden } from '../lib/dockAutoHide';
import {
  prefetchCommunityChunks,
  prefetchEventsChunk,
  prefetchMoreChunk,
  prefetchPrayerChunk,
} from '../lib/prefetchMemberChunks';

type MemberNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  onPrefetch?: () => void;
  /** Show unread badge (Me absorbs Alerts). */
  showUnreadBadge?: boolean;
  /** Me tab: show the member's photo instead of the icon when they have one. */
  isMe?: boolean;
  /** Show emerald huddle live pulse (Community). */
  showHuddleLive?: boolean;
};

const ITEMS: MemberNavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: Home,
    match: (pathname) => pathname === '/',
  },
  {
    to: '/community',
    label: 'Community',
    icon: Users,
    match: (pathname) =>
      pathname === '/community' ||
      pathname.startsWith('/community/post/') ||
      pathname === '/community/chat' ||
      pathname.startsWith('/community/chat/'),
    onPrefetch: prefetchCommunityChunks,
    showHuddleLive: true,
  },
  {
    to: '/events',
    label: 'Events',
    icon: Calendar,
    match: (pathname) => pathname === '/events',
    onPrefetch: prefetchEventsChunk,
  },
  {
    to: '/prayer',
    label: 'Prayer',
    icon: HandHeart,
    match: (pathname) => pathname === '/prayer',
    onPrefetch: prefetchPrayerChunk,
  },
  {
    to: '/me',
    label: 'Me',
    icon: UserRound,
    match: (pathname) =>
      pathname === '/me' ||
      pathname === '/more' ||
      pathname === '/profile' ||
      pathname === '/account' ||
      pathname === '/notifications' ||
      pathname === '/my-attendance' ||
      pathname === '/serve/my' ||
      pathname === '/notes' ||
      pathname === '/bible' ||
      pathname.startsWith('/notes/') ||
      pathname === '/card' ||
      pathname.startsWith('/card/') ||
      pathname === '/family' ||
      pathname.startsWith('/family/') ||
      pathname === '/kids-plans' ||
      pathname.startsWith('/kids-plans/'),
    onPrefetch: prefetchMoreChunk,
    showUnreadBadge: true,
    isMe: true,
  },
];

/**
 * Member bottom bar — Home · Community · Events · Prayer · Me · Apps — Red Earth & Gold:
 * a floating charcoal dock above the bottom edge, warm-grey icons with their
 * names, and gold for the tab you're on. Hides while you
 * scroll down and comes back when you scroll up or tap into it (same as before).
 */
export const MemberNav: React.FC = () => {
  const location = useLocation();
  const { unreadBadge } = useNotifications();
  const { identity } = useAuth();
  const avatarUrl = identity?.avatarUrl || null;
  const { anyLive } = useHuddleLive();
  const dockHidden = useDockHidden();
  const [appsOpen, setAppsOpen] = useState(false);

  return (
    <div
      onFocusCapture={showDock}
      className={`pointer-events-none fixed bottom-0 left-1/2 z-[110] w-full max-w-[500px] -translate-x-1/2 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        dockHidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <nav
        className="awc-dock pointer-events-auto flex items-stretch px-1"
        aria-label="Member navigation"
      >
        {ITEMS.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          const showBadge = Boolean(item.showUnreadBadge && unreadBadge);
          const showHuddle = Boolean(item.showHuddleLive && anyLive);

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              aria-label={
                showHuddle
                  ? `${item.label}, live Ka Link`
                  : showBadge
                    ? `${item.label}, ${unreadBadge} unread`
                    : item.label
              }
              title={item.label}
              onFocus={() => item.onPrefetch?.()}
              onMouseEnter={() => item.onPrefetch?.()}
              onTouchStart={() => item.onPrefetch?.()}
              className={`awc-dock-tab relative flex min-h-[64px] min-w-0 basis-0 ${item.label.length > 7 ? 'grow-[1.3]' : 'grow'} flex-col items-center justify-center gap-1 pt-1.5 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F4B23E] active:bg-white/[0.04] ${
                active ? 'text-[#F4B23E]' : 'text-[#BBA898] hover:text-[#F7EFE6]'
              }`}
            >
              <span className="relative inline-flex shrink-0 items-center justify-center">
                {item.isMe && avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className={`h-[24px] w-[24px] rounded-full object-cover ${active ? 'ring-2 ring-[#F4B23E]' : 'ring-1 ring-white/20'}`}
                  />
                ) : (
                  <Icon size={23} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                )}
                {showHuddle ? (
                  <span className="absolute -right-1 -top-0.5">
                    <HuddleLiveDot size="md" label="" />
                  </span>
                ) : null}
                {showBadge ? (
                  <span className="absolute -right-3 -top-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#FF7A5C] text-[#15100D] text-xs font-extrabold leading-5 text-center ring-2 ring-[#211915]">
                    {unreadBadge}
                  </span>
                ) : null}
              </span>
              {/* Every tab keeps its name under the icon — easier for members who read the words. */}
              <span aria-hidden className={`max-w-full truncate text-[12px] leading-none tracking-[-0.01em] ${active ? 'font-bold' : 'font-semibold'}`}>
                {item.label}
              </span>
              <span
                aria-hidden
                className={`awc-dock-mark absolute bottom-1.5 h-[3px] rounded-full bg-[#F4B23E] ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`}
              />
            </Link>
          );
        })}
        {/* Apps: one tap to Ka Link (signed in), Canaan (staff) or all PLCC apps. */}
        <button
          type="button"
          onClick={() => setAppsOpen(true)}
          aria-haspopup="dialog"
          title="Apps"
          data-testid="dock-apps"
          className="awc-dock-tab relative flex min-h-[64px] min-w-0 basis-0 grow flex-col items-center justify-center gap-1 pt-1.5 pb-2 text-[#BBA898] hover:text-[#F7EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F4B23E] active:bg-white/[0.04]"
        >
          <LayoutGrid size={23} strokeWidth={1.8} aria-hidden />
          <span aria-hidden className="max-w-full truncate text-[12px] leading-none tracking-[-0.01em] font-semibold">Apps</span>
        </button>
      </nav>
      </div>
      {appsOpen ? <AppsSheet onClose={() => setAppsOpen(false)} /> : null}
    </div>
  );
};
