import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Radio } from 'lucide-react';
import { EventDetailModule } from '../EventDetailModule';
import { MemberHomeSection } from './MemberHomeSection';
import { EmptyState, ErrorState, LoadingState } from '../ui/States';
import { fetchMemberHomeEvents } from '../../lib/memberHomeData';
import {
  filterEventsToday,
  formatEventTime,
} from '../../lib/memberHomeEvents';
import { isYouTubeLiveUrl, resolveLatestVideoUrl } from '../../lib/youtube';
import type { ChurchEvent } from '../../types';

export const MemberHomeToday: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayEvents, setTodayEvents] = useState<ChurchEvent[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [events, videoUrl] = await Promise.all([
        fetchMemberHomeEvents({ limit: 12 }),
        resolveLatestVideoUrl().catch(() => ''),
      ]);
      setTodayEvents(filterEventsToday(events));
      setLiveUrl(videoUrl && isYouTubeLiveUrl(videoUrl) ? videoUrl : null);
    } catch {
      setError('Could not load today’s schedule.');
      setTodayEvents([]);
      setLiveUrl(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <MemberHomeSection title="☀️ Today at PLCC">
      {loading ? <LoadingState message="Checking today’s schedule…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && liveUrl ? (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-[#1A1A1A] text-white px-4 py-3.5 min-h-[52px] mb-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/90">
            <Radio size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-red-300">Live now</p>
            <p className="text-sm font-bold truncate">Watch the livestream</p>
          </div>
        </a>
      ) : null}
      {!loading && !error && todayEvents.length === 0 && !liveUrl ? (
        <EmptyState
          message="Nothing scheduled at PLCC today."
          hint="Check Upcoming for what’s next."
        />
      ) : null}
      {!loading && !error
        ? todayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelected(event)}
              className="w-full text-left rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
            >
              {event.image_url ? (
                <img
                  src={event.image_url}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              ) : null}
              <div className="p-4 space-y-1.5">
                <p className="text-sm font-bold text-[#1A1A1A] leading-snug">{event.title}</p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar size={12} className="text-gold shrink-0" aria-hidden />
                  {formatEventTime(event.starts_at, event.time)}
                  {event.end_time ? ` – ${event.end_time}` : ''}
                </p>
                {event.location ? (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin size={12} className="shrink-0" aria-hidden />
                    <span className="truncate">{event.location}</span>
                  </p>
                ) : null}
                <span className="inline-block pt-1 text-xs font-black uppercase tracking-widest text-burgundy">
                  Event details
                </span>
              </div>
            </button>
          ))
        : null}
      <EventDetailModule
        event={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </MemberHomeSection>
  );
};
