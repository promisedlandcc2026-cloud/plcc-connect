import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar,
  HandHeart,
  Home,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { useHuddleLive } from '../context/HuddleLiveContext';
import { HuddleLiveDot } from './huddle/HuddleLiveDot';
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
 * How much room a tab takes. The current tab widens; "Community" (the long
 * name) always gets a little extra so it never shows as "Commu…".
 */
function tabGrow(label: string, active: boolean): string {
  const long = label.length > 7;
  if (active) return long ? 'grow-[1.6]' : 'grow-[1.3]';
  return long ? 'grow-[1.4]' : 'grow';
}

/**
 * Member bottom bar — Home · Community · Events · Prayer · Me — as the
 * Sanctuary floating glass dock: every tab shows its icon and name; the tab
 * you're on widens into a gold-leaf pill that slides over when you switch.
 * Plain CSS transitions (flex-grow), no animation library; reduced-motion
 * users get an instant switch.
 */
export const MemberNav: React.FC = () => {
  const location = useLocation();
  const { unreadBadge } = useNotifications();
  const { identity } = useAuth();
  const avatarUrl = identity?.avatarUrl || null;
  const { anyLive } = useHuddleLive();
  const dockHidden = useDockHidden();

  return (
    <div
      onFocusCapture={showDock}
      className={`pointer-events-none fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[110] w-full max-w-[500px] -translate-x-1/2 px-3 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        dockHidden ? 'translate-y-[calc(100%+max(12px,env(safe-area-inset-bottom))+8px)]' : 'translate-y-0'
      }`}
    >
      <nav
        className="awc-dock pointer-events-auto flex h-[68px] items-center rounded-[34px] px-1.5"
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
                  ? `${item.label}, live huddle`
                  : showBadge
                    ? `${item.label}, ${unreadBadge} unread`
                    : item.label
              }
              title={item.label}
              onFocus={() => item.onPrefetch?.()}
              onMouseEnter={() => item.onPrefetch?.()}
              onTouchStart={() => item.onPrefetch?.()}
              className={`awc-dock-tab relative flex active:scale-[0.97] h-14 min-w-0 basis-0 flex-col items-center justify-center gap-1 rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf ${
                active ? 'bg-leaf text-wine' : 'text-cream/85 hover:text-cream active:bg-white/10'
              } ${tabGrow(item.label, active)}`}
            >
              <span className="relative inline-flex shrink-0 items-center justify-center">
                {item.isMe && avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className={`h-[22px] w-[22px] rounded-full object-cover ${active ? 'ring-2 ring-wine' : 'ring-1 ring-cream/50'}`}
                  />
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                )}
                {showHuddle ? (
                  <span className="absolute -right-1 -top-0.5">
                    <HuddleLiveDot size="md" label="" />
                  </span>
                ) : null}
                {showBadge ? (
                  <span className="absolute -right-3 -top-1.5 min-w-[20px] h-5 px-1 rounded-full bg-burgundy text-white text-xs font-extrabold leading-5 text-center ring-2 ring-wine-night">
                    {unreadBadge}
                  </span>
                ) : null}
              </span>
              {/* Every tab keeps its name under the icon — easier for members who read the words. */}
              <span aria-hidden className="max-w-full truncate px-0.5 text-xs font-bold leading-none tracking-[-0.02em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
