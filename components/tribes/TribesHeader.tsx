import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronLeft, MessageCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { useHuddleLive } from '../../context/HuddleLiveContext';
import { HuddleLiveDot } from '../huddle/HuddleLiveDot';
import { prefetchNotificationsChunk } from '../../lib/prefetchMemberChunks';

const ICON_BTN =
  'relative inline-flex h-11 w-11 items-center justify-center rounded-full text-[#F6EFDD] hover:bg-white/10 active:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C36A]';

/**
 * PLCC Tribes top bar: forest green, the official sun-and-road mark, ivory
 * wordmark, Ka Link and the existing notifications action.
 * Full-bleed inside the page's px-5 main.
 */
export const TribesHeader: React.FC<{ showChat?: boolean }> = ({ showChat = true }) => {
  const { unreadBadge } = useNotifications();
  const { anyLive } = useHuddleLive();
  return (
    <header className="tribes-bar -mx-5 flex items-center px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] gap-2 min-[360px]:gap-3">
      <Link
        to="/"
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 min-[360px]:gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C36A]"
        aria-label="PLCC Tribes home"
      >
        <img src="/awc_connect_logo.png" alt="" width={40} height={40} className="h-9 w-9 min-[360px]:h-10 min-[360px]:w-10 shrink-0 rounded-full" />
        <span aria-hidden className="h-7 w-px shrink-0 bg-[#E4C36A]/50" />
        <span className="truncate font-display text-[21px] min-[360px]:text-[24px] font-bold leading-none text-[#F6EFDD]">PLCC Tribes</span>
      </Link>
      {showChat ? (
        <Link to="/community/chat" className={ICON_BTN} aria-label={anyLive ? 'Ka Link, live now' : 'Ka Link'}>
          <MessageCircle size={21} aria-hidden />
          {anyLive ? (
            <span className="absolute right-1 top-1">
              <HuddleLiveDot size="sm" label="" />
            </span>
          ) : null}
        </Link>
      ) : null}
      <Link
        to="/notifications"
        className={ICON_BTN}
        aria-label={unreadBadge ? `Notifications, ${unreadBadge} unread` : 'Notifications'}
        onFocus={() => prefetchNotificationsChunk()}
        onMouseEnter={() => prefetchNotificationsChunk()}
        onTouchStart={() => prefetchNotificationsChunk()}
      >
        <Bell size={21} aria-hidden />
        {unreadBadge ? (
          <span className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] rounded-full bg-[#E4C36A] px-1 text-center text-xs font-black leading-5 text-[#12231c]">
            {unreadBadge}
          </span>
        ) : null}
      </Link>
    </header>
  );
};

/** Ivory sub-bar under the header on a single post: back chevron + centred title. */
export const TribesSubBar: React.FC<{ title: string; backTo: string; backLabel: string; extra?: React.ReactNode }> = ({
  title,
  backTo,
  backLabel,
  extra,
}) => (
  <div className="-mx-5 border-b border-[#E8DCC2] bg-[#FBF7EE] px-2">
    <div className="relative flex min-h-[56px] items-center">
      <Link
        to={backTo}
        aria-label={`Back to ${backLabel}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#1d372c] hover:bg-[#1d372c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40"
      >
        <ChevronLeft size={24} aria-hidden />
      </Link>
      <h1 className="pointer-events-none absolute inset-x-14 text-center text-[20px] font-extrabold text-[#12231c]">{title}</h1>
      {extra ? <div className="ml-auto">{extra}</div> : null}
    </div>
  </div>
);
