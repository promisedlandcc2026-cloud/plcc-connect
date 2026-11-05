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
import { memberHomeGreeting } from '../../lib/memberGreeting';
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
import { StainedGlass, StainedGlassGreeting } from '../sanctuary/StainedGlassGreeting';
import { NextUpTicket } from '../sanctuary/NextUpTicket';
import { TodayStories } from '../sanctuary/TodayStories';
import { SundayLiveHome } from '../sanctuary/SundayLiveHome';
import { LiveHuddles } from '../sanctuary/LiveHuddles';
import type { ChurchEvent } from '../../types';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

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

  return (
    <header className="relative px-5 pt-3 pb-1 space-y-6">
      {!live ? <StainedGlass /> : null}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AWCLogo size={44} className="block shrink-0 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.25)]" />
          <BackToAwcOne />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openAssistant}
            className="inline-flex items-center gap-2 h-11 rounded-full bg-leaf text-wine pl-3.5 pr-4 text-sm font-bold shadow-sm active:scale-95 transition-transform motion-reduce:transition-none"
            aria-label="Ask PLCC Assistant"
          >
            <Sparkles size={16} fill="currentColor" aria-hidden />
            Ask PLCC
          </button>
          <HomeHeroActions showBell />
        </div>
      </div>

      <div className="relative space-y-6">
        {live ? (
          <SundayLiveHome title={service.title} startsAt={service.startsAt} eventId={serviceEventId} liveUrl={liveUrl} />
        ) : (
          <>
            <StainedGlassGreeting greeting={memberHomeGreeting(identity?.name ?? null, now)} now={now} />
            <NextUpTicket next={next} liveUrl={liveUrl} />
            <div className="-mx-5">
              <TodayStories />
            </div>
          </>
        )}

        <LiveHuddles />

        <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2">
          <button type="button" onClick={() => setGiveOpen(true)} className={actionClass}>
            <Heart size={20} className="text-leaf" aria-hidden />
            <span className="text-xs font-bold">Give</span>
          </button>
          <button type="button" onClick={() => setQrOpen(true)} className={actionClass}>
            <QrCode size={20} className="text-leaf" aria-hidden />
            <span className="text-xs font-bold">My QR</span>
          </button>
          <Link to="/notes" onTouchStart={prefetchNotesChunks} onFocus={prefetchNotesChunks} className={actionClass}>
            <BookOpen size={20} className="text-leaf" aria-hidden />
            <span className="text-xs font-bold">Notes</span>
          </Link>
          <button type="button" onClick={() => scrollToId('watch-live')} className={actionClass}>
            <PlayCircle size={20} className="text-leaf" aria-hidden />
            <span className="text-xs font-bold">Watch</span>
          </button>
        </nav>
      </div>

      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
      <MyPassQrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </header>
  );
};
