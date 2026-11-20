/**
 * Home top for visitors (Sanctuary) + the shared bell / account / sign-in actions.
 */
import { TribesMark } from '../tribes/TribesMark';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { daypartGreeting } from '../../lib/memberGreeting';
import { fetchMemberHomeEvents } from '../../lib/memberHomeData';
import { pickNextUp, type NextUp } from '../../lib/nextUp';
import { isYouTubeLiveUrl, resolveLatestVideoUrl } from '../../lib/youtube';
import { useNow } from '../../lib/useNow';
import { StainedGlassGreeting } from '../sanctuary/StainedGlassGreeting';
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
    <header>
      <h1 className="sr-only">Tribes — Promised Land Christian Center</h1>
      <div className="tribes-bar flex items-center gap-2 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 min-[360px]:gap-3">
          <TribesMark className="h-9 w-auto shrink-0 text-[#E4C36A] min-[360px]:h-10" />
          <span aria-hidden className="h-7 w-px shrink-0 bg-[#E4C36A]/45" />
          <span className="truncate font-display text-[21px] font-semibold leading-none text-[#F6EFDD] min-[360px]:text-[23px]">
            PLCC Tribes
          </span>
        </div>
        <HomeHeroActions showBell={showBell} />
      </div>

      <section className="tribes-hero px-5 pb-7 pt-8 text-center" aria-label="Welcome">
        <div className="mx-auto max-w-[380px] [&_p.font-display]:text-[34px] min-[360px]:[&_p.font-display]:text-[38px]">
          <StainedGlassGreeting
            as="p"
            greeting={`${daypartGreeting(now)}, friend`}
            tagline="Changing Hearts. Transforming Lives."
            now={now}
          />
        </div>
        <div className="mt-5 flex items-center justify-center gap-3" aria-hidden>
          <span className="h-px w-14 bg-[#E4C36A]/60" />
          <TribesMark className="h-7 w-auto text-[#E4C36A]" />
          <span className="h-px w-14 bg-[#E4C36A]/60" />
        </div>
      </section>

      <div className="space-y-6 px-5 pt-5">
        <NextUpTicket next={next} liveUrl={liveUrl} visitor />
        <div className="-mx-5">
          <TodayStories visitor tone="light" />
        </div>
      </div>
    </header>
  );
};
