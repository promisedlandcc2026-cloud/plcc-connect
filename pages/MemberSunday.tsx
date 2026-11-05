import React, { useEffect, useState } from 'react';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import { Link } from 'react-router-dom';
import {
  Bell,
  Calendar,
  HandHeart,
  Heart,
  MapPin,
  MessageCircle,
  Radio,
  Users,
  Wallet,
} from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { GiveModule } from '../components/GiveModule';
import { PrayerModule } from '../components/PrayerModule';
import { EventDetailModule } from '../components/EventDetailModule';
import { AnnouncementDetailModule } from '../components/AnnouncementDetailModule';
import { DigitalBulletin } from '../components/DigitalBulletin';
import { SermonNotes } from '../components/SermonNotes';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { CHURCH_INFO } from '../data';
import {
  fetchMemberHomeAnnouncements,
  fetchMemberHomeEvents,
  fetchMemberHomeLatestSermon,
  type HomeAnnouncement,
  type HomeSermonPreview,
} from '../lib/memberHomeData';
import {
  filterEventsToday,
  formatEventTime,
  truncateText,
} from '../lib/memberHomeEvents';
import { isYouTubeLiveUrl, resolveLatestVideoUrl } from '../lib/youtube';
import { fetchMyServing, ServeClientError } from '../lib/serveClient';
import { formatServeWhen, signupStatusLabel, type ServeMyItem } from '../lib/serveUi';
import {
  filterServingToday,
  formatSundayDateLabel,
  isLocalSunday,
  limitSundayAnnouncements,
  sundayGreeting,
} from '../lib/sundayMode';
import { notesNewPath, startContextFromSermonPreview } from '../lib/sermonNotesUi';
import type { Announcement, ChurchEvent } from '../types';

/** Isolated Watch / Live section — Live Now only when URL is a real live path. */
const SundayWatchSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [live, setLive] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await resolveLatestVideoUrl();
      setVideoUrl(url);
      setLive(isYouTubeLiveUrl(url));
    } catch {
      setError('Could not load Watch.');
      setVideoUrl('');
      setLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section aria-labelledby="sunday-watch-heading" className="space-y-3">
      <h2
        id="sunday-watch-heading"
        className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
      >
        Service / Watch
      </h2>
      {loading ? <LoadingState message="Loading Watch…" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && live && videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-[#1A1A1A] text-white px-4 py-4 min-h-[52px]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/90">
            <Radio size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-red-300">Live Now</p>
            <p className="text-sm font-bold">Watch Live</p>
          </div>
        </a>
      ) : null}
      {!loading && !error && !live && videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 min-h-[52px] shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
            <Radio size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1A1A1A]">Latest message</p>
            <p className="text-xs text-gray-500">Open Watch on YouTube</p>
          </div>
        </a>
      ) : null}
    </section>
  );
};

const SundayTodayEvents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchMemberHomeEvents({ limit: 12 });
      setEvents(filterEventsToday(all));
    } catch {
      setError('Could not load today’s events.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section aria-labelledby="sunday-today-heading" className="space-y-3">
      <h2
        id="sunday-today-heading"
        className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
      >
        Today at PLCC
      </h2>
      {loading ? <LoadingState message="Loading today’s events…" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <EmptyState message="Nothing else is scheduled today." />
      ) : null}
      {!loading && !error
        ? events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelected(event)}
              className="w-full text-left rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:scale-[0.99] transition-transform"
            >
              <p className="text-sm font-bold text-[#1A1A1A]">{event.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar size={12} className="text-gold shrink-0" aria-hidden />
                {formatEventTime(event.starts_at, event.time)}
              </p>
              {event.location ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} className="shrink-0" aria-hidden />
                  <span className="truncate">{event.location}</span>
                </p>
              ) : null}
            </button>
          ))
        : null}
      <EventDetailModule
        isOpen={Boolean(selected)}
        event={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
};

const SundayServingToday: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ServeMyItem[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyServing();
      setItems(filterServingToday(data.items));
    } catch (err) {
      if (err instanceof ServeClientError) {
        setError(err.message);
      } else {
        setError('Could not load your Serve assignments.');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!loading && !error && items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="sunday-serve-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2
          id="sunday-serve-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy"
        >
          My Serving Today
        </h2>
        <Link to="/serve/my" className="text-xs font-bold text-burgundy min-h-[44px] inline-flex items-center">
          My Serving
        </Link>
      </div>
      {loading ? <LoadingState message="Loading your Serve assignments…" /> : null}
      {!loading && error ? (
        <div role="alert">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : null}
      {!loading && !error
        ? items.map((item) => (
            <Link
              key={item.id}
              to={`/serve/${item.opportunityId}`}
              className="block rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-[#1A1A1A] leading-snug">
                  {item.opportunity?.title || 'Serve opportunity'}
                </p>
                <span className="shrink-0 rounded-lg bg-gray-50 px-2 py-1 text-xs font-bold text-gray-700">
                  {signupStatusLabel(item.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {formatServeWhen(item.opportunity?.startsAt, item.opportunity?.endsAt)}
              </p>
              {item.opportunity?.location ? (
                <p className="mt-0.5 text-xs text-gray-500">{item.opportunity.location}</p>
              ) : null}
            </Link>
          ))
        : null}
    </section>
  );
};

const SundaySermonSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sermon, setSermon] = useState<HomeSermonPreview | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSermon(await fetchMemberHomeLatestSermon());
    } catch {
      setError('Could not load the latest message.');
      setSermon(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section aria-labelledby="sunday-sermon-heading" className="space-y-3">
      <h2
        id="sunday-sermon-heading"
        className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
      >
        Sermon / Message
      </h2>
      {loading ? <LoadingState message="Loading message…" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && !sermon ? (
        <div className="space-y-3">
          <EmptyState message="No message is available right now." />
          <Link
            to="/notes/new"
            className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            Take Notes
          </Link>
        </div>
      ) : null}
      {!loading && !error && sermon ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-2">
          <p className="text-sm font-bold text-[#1A1A1A] leading-snug">{sermon.title}</p>
          {sermon.speaker ? (
            <p className="text-xs text-gray-500">{sermon.speaker}</p>
          ) : null}
          {sermon.watchUrl ? (
            <a
              href={sermon.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] text-sm font-bold text-burgundy"
            >
              Open message
            </a>
          ) : null}
          <Link
            to={notesNewPath(startContextFromSermonPreview(sermon))}
            className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-burgundy/10 px-4 text-sm font-bold text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            Take Notes
          </Link>
        </div>
      ) : null}
    </section>
  );
};

const SundayAnnouncements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HomeAnnouncement[]>([]);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchMemberHomeAnnouncements({ limit: 3 });
      setItems(limitSundayAnnouncements(all, 3));
    } catch {
      setError('Could not load announcements.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!loading && !error && items.length === 0) return null;

  return (
    <section aria-labelledby="sunday-announce-heading" className="space-y-3">
      <h2
        id="sunday-announce-heading"
        className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
      >
        Announcements
      </h2>
      {loading ? <LoadingState message="Loading announcements…" /> : null}
      {!loading && error ? (
        <div role="alert">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : null}
      {!loading && !error ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  setSelected({
                    id: item.id,
                    title: item.title,
                    description: item.summary,
                    date: item.dateLabel,
                    imageUrl: item.imageUrl || undefined,
                  })
                }
                className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-bold text-[#1A1A1A]">{item.title}</p>
                {item.summary ? (
                  <p className="mt-1 text-xs text-gray-500">{truncateText(item.summary, 100)}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <AnnouncementDetailModule announcement={selected} onClose={() => setSelected(null)} />
    </section>
  );
};

/**
 * Sunday Mode — focused service experience for approved members.
 * Sections load independently; one failure does not blank the page.
 */
export const MemberSundayPage: React.FC = () => {
  // Members keep this open through the service — don't let the phone sleep.
  useScreenWakeLock(true);
  const { identity } = useAuth();
  const { unreadBadge } = useNotifications();
  const [giveOpen, setGiveOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [showBulletin, setShowBulletin] = useState(true);

  const sunday = isLocalSunday();
  const sundaySchedule = CHURCH_INFO.schedule.find((s) => s.day === 'Sunday');

  return (
    <main className="flex-1 px-5 pt-10 pb-28 space-y-8">
      <MemberPageHeader
        title="Sunday at PLCC"
        eyebrow="Sunday Mode"
        subtitle={formatSundayDateLabel()}
        backTo="/"
        backLabel="Home"
      />

      <header className="space-y-2">
        <p className="text-lg font-bold text-[#1A1A1A]">{sundayGreeting(identity?.name)}</p>
        {sunday && sundaySchedule ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 space-y-1">
            <p className="text-sm font-bold text-[#1A1A1A]">{sundaySchedule.event}</p>
            <p className="text-xs text-gray-600">{sundaySchedule.time}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <MapPin size={12} aria-hidden />
              {CHURCH_INFO.address}
            </p>
          </div>
        ) : null}
        {!sunday ? (
          <p className="text-xs text-gray-500 leading-relaxed">
            Sunday Mode stays available all week. Home highlights it on Sundays.
          </p>
        ) : null}
      </header>

      {unreadBadge ? (
        <Link
          to="/notifications"
          className="flex items-center gap-3 rounded-2xl border border-burgundy/15 bg-burgundy/5 px-4 py-3 min-h-[48px]"
        >
          <Bell size={18} className="text-burgundy" aria-hidden />
          <span className="text-sm font-bold text-[#1A1A1A]">
            {unreadBadge} unread notification{unreadBadge === '1' ? '' : 's'}
          </span>
        </Link>
      ) : null}

      <SundayWatchSection />
      <SundayTodayEvents />
      <SundayServingToday />
      <SundaySermonSection />

      <section aria-labelledby="sunday-prayer-heading" className="space-y-3">
        <h2
          id="sunday-prayer-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Prayer
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPrayerOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-4 min-h-[88px] shadow-sm"
          >
            <Heart size={18} className="text-burgundy" aria-hidden />
            <span className="text-xs font-bold text-[#1A1A1A] text-center">Pray</span>
          </button>
          <Link
            to="/prayer"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-4 min-h-[88px] shadow-sm"
          >
            <Heart size={18} className="text-burgundy" aria-hidden />
            <span className="text-xs font-bold text-[#1A1A1A] text-center">Prayer Wall</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="sunday-give-heading" className="space-y-3">
        <h2
          id="sunday-give-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Give
        </h2>
        <button
          type="button"
          onClick={() => setGiveOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold"
        >
          <Wallet size={18} aria-hidden />
          Give
        </button>
      </section>

      <SundayAnnouncements />

      <section aria-labelledby="sunday-connect-heading" className="space-y-3">
        <h2
          id="sunday-connect-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Community / Chat
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/community"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-4 min-h-[88px] shadow-sm"
          >
            <Users size={18} className="text-burgundy" aria-hidden />
            <span className="text-xs font-bold text-[#1A1A1A]">Community</span>
          </Link>
          <Link
            to="/community/chat"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-4 min-h-[88px] shadow-sm"
          >
            <MessageCircle size={18} className="text-burgundy" aria-hidden />
            <span className="text-xs font-bold text-[#1A1A1A]">Chat</span>
          </Link>
        </div>
        <Link
          to="/serve"
          className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[48px] shadow-sm"
        >
          <HandHeart size={18} className="text-burgundy" aria-hidden />
          <span className="text-sm font-bold text-[#1A1A1A]">Browse Serve</span>
        </Link>
      </section>

      <section aria-labelledby="sunday-message-guide-heading" className="space-y-3">
        <h2
          id="sunday-message-guide-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Message Guide
        </h2>
        <SermonNotes />
      </section>

      <section aria-labelledby="sunday-bulletin-heading" className="space-y-3">
        <h2
          id="sunday-bulletin-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Sunday Bulletin
        </h2>
        <button
          type="button"
          onClick={() => setShowBulletin((v) => !v)}
          className="w-full text-left rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[48px] shadow-sm"
          aria-expanded={showBulletin}
        >
          <p className="text-sm font-bold text-[#1A1A1A]">
            {showBulletin ? 'Hide digital bulletin' : 'Open digital bulletin'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Service segments and today’s inspiration</p>
        </button>
        {showBulletin ? (
          <div className="rounded-2xl overflow-hidden border border-gray-100">
            <DigitalBulletin />
          </div>
        ) : null}
      </section>

      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
      <PrayerModule isOpen={prayerOpen} onClose={() => setPrayerOpen(false)} />
    </main>
  );
};
