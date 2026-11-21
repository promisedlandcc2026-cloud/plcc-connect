/**
 * Member Home top (Sanctuary evening shell).
 *
 * Weekday: stained-glass greeting, the Next-up ticket with its countdown ring
 * and "I'll be there", then the Today at PLCC story circles.
 * Sunday, service live: the in-service view (stream, I'm here, notes, order
 * of service) takes over the top of Home.
 * Both keep one row of four shortcuts: Give, My QR, Notes, Watch
 * (Prayer and Bible already live in the bottom bar / Today circles).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Heart, PlayCircle, QrCode, Sparkles } from 'lucide-react';
import { openAssistant } from '../AWCAssistant';
import { useAuth } from '../../context/AuthContext';
import { lugandaGreeting, memberHomeGreeting } from '../../lib/memberGreeting';
import { SkyArchHero } from '../tribes/SkyArchHero';
import { fetchMemberHomeEvents } from '../../lib/memberHomeData';
import { eventStartMs } from '../../lib/memberHomeEvents';
import { pickNextUp, type NextUp } from '../../lib/nextUp';
import { isServiceEvent, pickNextService } from '../../lib/nextService';
import { isSundayLive } from '../../lib/sanctuary';
import { isYouTubeLiveUrl, resolveLatestVideoUrl } from '../../lib/youtube';
import { prefetchNotesChunks } from '../../lib/prefetchMemberChunks';
import { useNow } from '../../lib/useNow';
import { AWCLogo } from '../ui/AWCLogo';
import { BackToAwcOne } from '../ui/BackToAwcOne';
import { HomeHeroActions } from '../home/HomeHero';
import { GiveModule } from '../GiveModule';
import { MyPassQrModal } from '../points/MyPassQrModal';
import { TribesMark } from '../tribes/TribesMark';
import { NextUpTicket } from '../sanctuary/NextUpTicket';
import { TodayStories } from '../sanctuary/TodayStories';
import { SundayLiveHome } from '../sanctuary/SundayLiveHome';
import { LiveHuddles } from '../sanctuary/LiveHuddles';
import type { ChurchEvent } from '../../types';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/** Ask PLCC Assistant — sparkle on phones, "Ask PLCC" on wider screens. */
const AskPlccButton: React.FC = () => (
  <button
    type="button"
    onClick={openAssistant}
    className="inline-flex items-center gap-1.5 h-11 rounded-full bg-leaf text-wine w-11 justify-center sm:w-auto sm:justify-start sm:pl-3 sm:pr-3.5 text-sm font-bold whitespace-nowrap shrink-0 shadow-sm active:scale-95 transition-transform motion-reduce:transition-none"
    aria-label="Ask PLCC Assistant"
  >
    <Sparkles size={16} fill="currentColor" aria-hidden />
    {/* Phones: sparkle only, so everything fits on one line. */}
    <span className="hidden sm:inline">Ask PLCC</span>
  </button>
);

const lightActionClass =
  'flex flex-col items-center justify-center gap-1.5 rounded-[18px] border border-[#E3D6BA] bg-white text-[#12231c] min-h-[68px] px-0.5 shadow-[0_1px_2px_rgba(18,35,28,0.04)] active:scale-95 transition-transform motion-reduce:transition-none hover:border-[#C9A35A]';

const actionClass =
  'flex flex-col items-center justify-center gap-1.5 rounded-[18px] bg-white/[0.06] border border-[#F2D98A]/20 text-cream min-h-[68px] px-0.5 active:scale-95 transition-transform motion-reduce:transition-none';

export const MemberHomeHeader: React.FC<{ onLiveChange?: (live: boolean) => void }> = ({ onLiveChange }) => {
  const { identity } = useAuth();
  const now = useNow(60_000);
  const [events, setEvents] = useState<ChurchEvent[] | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

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
  const service = useMemo(() => pickNextService(events || [], now), [events, now]);
  const serviceEventId = useMemo(() => {
    if (!events || !service.fromCalendar) return null;
    const match = events.find((e) => isServiceEvent(e) && eventStartMs(e) === service.startsAt.getTime());
    return match ? String(match.id) : null;
  }, [events, service]);

  const live = isSundayLive({ now, serviceStartsAt: events ? service.startsAt : null, streamLive: Boolean(liveUrl) && now.getDay() === 0 });

  useEffect(() => {
    onLiveChange?.(live);
  }, [live, onLiveChange]);

  const quickActions = (tone: 'dark' | 'light') => {
    const cls = tone === 'light' ? lightActionClass : actionClass;
    const icon = tone === 'light' ? 'text-gold-ink' : 'text-leaf';
    return (
      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => setGiveOpen(true)} className={cls}>
          <Heart size={20} className={icon} aria-hidden />
          <span className="text-xs font-bold">Give</span>
        </button>
        <button type="button" onClick={() => setQrOpen(true)} className={cls}>
          <QrCode size={20} className={icon} aria-hidden />
          <span className="text-xs font-bold">My QR</span>
        </button>
        <Link to="/notes" onTouchStart={prefetchNotesChunks} onFocus={prefetchNotesChunks} className={cls}>
          <BookOpen size={20} className={icon} aria-hidden />
          <span className="text-xs font-bold">Notes</span>
        </Link>
        <button type="button" onClick={() => scrollToId('watch-live')} className={cls}>
          <PlayCircle size={20} className={icon} aria-hidden />
          <span className="text-xs font-bold">Watch</span>
        </button>
      </nav>
    );
  };

  const modals = (
    <>
      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
      <MyPassQrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );

  // Sunday while service is live: the in-service view on the evening shell (unchanged).
  if (live) {
    return (
      <header className="relative px-5 pt-3 pb-1 space-y-6">
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AWCLogo size={44} className="block shrink-0 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.25)]" />
            <BackToAwcOne />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <AskPlccButton />
            <HomeHeroActions showBell />
          </div>
        </div>
        <div className="relative space-y-6">
          <SundayLiveHome title={service.title} startsAt={service.startsAt} eventId={serviceEventId} liveUrl={liveUrl} />
          <LiveHuddles />
          {quickActions('dark')}
        </div>
        {modals}
      </header>
    );
  }

  // Weekdays: PLCC Tribes — forest bar, sky arch (weather + time of day), then ivory cards on forest.
  return (
    <header>
      <div className="tribes-bar flex items-center gap-2 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 min-[360px]:gap-3">
          <TribesMark className="h-10 w-auto shrink-0 text-[#E4C36A] min-[360px]:h-11" />
          <span aria-hidden className="h-9 w-px shrink-0 bg-[#E4C36A]/55" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="tribes-gold-text truncate font-display text-[26px] font-bold min-[360px]:text-[28px]">Tribes</span>
            <span className="mt-1 truncate text-[11px] font-semibold tracking-[0.24em] text-[#F4ECDB]/85">PROMISED LAND CC</span>
          </span>
        </div>
        <HomeHeroActions showBell />
      </div>

      <SkyArchHero bleed={false} minHeight={268} ariaLabel="Welcome">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <BackToAwcOne className="!h-10 !text-[13px] !border !shadow-none" />
          <button
            type="button"
            onClick={openAssistant}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-leaf pl-3 pr-3.5 text-[13px] font-bold text-wine shadow-sm active:scale-95 transition-transform motion-reduce:transition-none"
            aria-label="Ask PLCC Assistant"
          >
            <Sparkles size={15} fill="currentColor" aria-hidden />
            Ask PLCC
          </button>
        </div>
        <div className="max-w-[64%] px-7 pb-8 pt-6 min-[400px]:px-9">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#E4C36A]">{lugandaGreeting(now)}</p>
          <h1 className="tribes-gold-text mt-1.5 font-display text-[34px] font-bold leading-[1.05] min-[380px]:text-[38px]">
            {memberHomeGreeting(identity?.name ?? null, now)}
          </h1>
          <span aria-hidden className="mt-3 block h-[3px] w-12 rounded-full bg-[#E4C36A]" />
          <p className="mt-3 text-[14px] font-medium leading-snug text-[#F4ECDB]">One family. Many nations. One purpose.</p>
        </div>
      </SkyArchHero>

      <div className="tribes-home-top space-y-6 px-5 pt-5">
        <NextUpTicket next={next} liveUrl={liveUrl} />
        <div className="-mx-5">
          <TodayStories tone="light" />
        </div>
        <LiveHuddles tone="light" />
        {quickActions('light')}
      </div>
      {modals}
    </header>
  );
};
