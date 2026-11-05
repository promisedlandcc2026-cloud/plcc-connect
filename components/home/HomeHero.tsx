/**
 * Home top for visitors (Sanctuary) + the shared bell / account / sign-in actions.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { AWCLogo } from '../ui/AWCLogo';
import { useAuth } from '../../context/AuthContext';
import { daypartGreeting } from '../../lib/memberGreeting';
import { fetchMemberHomeEvents } from '../../lib/memberHomeData';
import { pickNextUp, type NextUp } from '../../lib/nextUp';
import { isYouTubeLiveUrl, resolveLatestVideoUrl } from '../../lib/youtube';
import { useNow } from '../../lib/useNow';
import { StainedGlass, StainedGlassGreeting } from '../sanctuary/StainedGlassGreeting';
import { NextUpTicket } from '../sanctuary/NextUpTicket';
import { TodayStories } from '../sanctuary/TodayStories';
import type { ChurchEvent } from '../../types';
import { useNotifications } from '../../context/NotificationsContext';
import { canLoadNotificationInbox } from '../../lib/memberNotificationsTypes';
import {
  prefetchAccountChunk,
  prefetchNotificationsChunk,
} from '../../lib/prefetchMemberChunks';

type HomeHeroProps = {
  /** Show member notification + account controls */
  variant?: 'member' | 'public';
};

/** Bell + account / sign-in buttons for the burgundy home shell. */
export const HomeHeroActions: React.FC<{ showBell: boolean; className?: string }> = ({
  showBell,
  className = 'flex items-center gap-1.5',
}) => {
  const { isAuthenticated, isLoading, memberAccessState } = useAuth();
  const { unreadBadge } = useNotifications();
  const accountTo = memberAccessState === 'approved_member' ? '/me' : '/account';
  return (
        <div className={className}>
          {showBell ? (
            <Link
              to="/notifications"
              className="relative inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/[0.06] border border-[#F2D98A]/30 text-cream hover:bg-white/10 transition-colors"
              aria-label={
                unreadBadge ? `Notifications, ${unreadBadge} unread` : 'Notifications'
              }
              onFocus={() => prefetchNotificationsChunk()}
              onMouseEnter={() => prefetchNotificationsChunk()}
              onTouchStart={() => prefetchNotificationsChunk()}
            >
              <Bell size={18} aria-hidden />
              {unreadBadge ? (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-gold text-[#1A1A1A] text-xs font-black leading-5">
                  {unreadBadge}
                </span>
              ) : null}
            </Link>
          ) : null}

          {!isLoading ? (
            isAuthenticated ? (
              <Link
                to={accountTo}
                className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-white/[0.06] border border-[#F2D98A]/30 text-cream hover:bg-white/10 transition-colors"
                aria-label="Open account"
                onFocus={() => prefetchAccountChunk()}
                onMouseEnter={() => prefetchAccountChunk()}
              >
                <UserRound size={18} aria-hidden />
              </Link>
            ) : (
              <Link
                to="/sign-in"
                state={{ intent: 'signin' }}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-leaf text-wine text-sm font-bold shadow-sm hover:bg-[#F2D98A] transition-colors"
                aria-label="Member sign in"
              >
                Sign in
              </Link>
            )
          ) : null}
        </div>
  );
};

/**
 * Visitor / pending Home top (Sanctuary): stained-glass welcome, the next
 * gathering as a ticket with "Plan a visit", and Today at PLCC stories.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({ variant = 'public' }) => {
  const { isAuthenticated, isLoading, memberAccessState } = useAuth();
  const showMemberChrome = variant === 'member';
  const showBell =
    showMemberChrome ||
    (!isLoading && canLoadNotificationInbox(isAuthenticated, memberAccessState));
  const now = useNow(60_000);
  const [events, setEvents] = useState<ChurchEvent[] | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMemberHomeEvents({ limit: 12 })
      .then((list) => alive && setEvents(list))
      .catch(() => alive && setEvents([]));
    resolveLatestVideoUrl()
      .then((url) => {
        if (alive && url && isYouTubeLiveUrl(url)) setLiveUrl(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const next: NextUp | null = useMemo(() => (events ? pickNextUp(events, now) : null), [events, now]);

  return (
    <header className="relative px-5 pt-3 pb-1 space-y-6">
      <h1 className="sr-only">PLCC Connect — Promised Land Christian Center</h1>
      <StainedGlass />
      <div className="relative flex items-center justify-between gap-3">
        <AWCLogo size={52} className="block rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.25)]" />
        <HomeHeroActions showBell={showBell} />
      </div>

      <div className="relative space-y-6">
        <StainedGlassGreeting
          as="p"
          greeting={`${daypartGreeting(now)}, friend`}
          tagline="Changing Hearts. Transforming Lives."
          now={now}
        />
        <NextUpTicket next={next} liveUrl={liveUrl} visitor />
        <div className="-mx-5">
          <TodayStories visitor />
        </div>
      </div>
    </header>
  );
};
