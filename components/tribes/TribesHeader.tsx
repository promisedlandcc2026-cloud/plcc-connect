import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronLeft, MessageCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { useHuddleLive } from '../../context/HuddleLiveContext';
import { HuddleLiveDot } from '../huddle/HuddleLiveDot';
import { prefetchNotificationsChunk } from '../../lib/prefetchMemberChunks';
import { TribesMark } from './TribesMark';

const ICON_BTN =
  'relative inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-[#211915] text-[#F7EFE6] hover:bg-[#2B211B] active:bg-[#3A2E27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B23E]';

/**
 * PLCC Tribes top bar (Red Earth & Gold): dark ground, the sun-and-road mark in
 * gold, "Tribes" wordmark, Ka Link and the existing notifications action.
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
        <TribesMark className="h-8 w-auto shrink-0 text-[#F4B23E] min-[360px]:h-9" />
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-display text-[23px] font-extrabold text-[#F7EFE6]">Tribes</span>
          <span className="mt-1 truncate text-[11px] font-semibold tracking-[0.18em] text-[#BBA898]">PROMISED LAND CC</span>
        </span>
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
          <span className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] rounded-full bg-[#FF7A5C] px-1 text-center text-xs font-black leading-5 text-[#15100D]">
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
  <div className="-mx-5 border-b border-white/10 bg-[#15100D] px-2">
    <div className="relative flex min-h-[56px] items-center">
      <Link
        to={backTo}
        aria-label={`Back to ${backLabel}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#F7EFE6] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B23E]"
      >
        <ChevronLeft size={24} aria-hidden />
      </Link>
      <h1 className="pointer-events-none absolute inset-x-14 text-center font-display text-[20px] font-extrabold text-[#F7EFE6]">{title}</h1>
      {extra ? <div className="ml-auto">{extra}</div> : null}
    </div>
  </div>
);
