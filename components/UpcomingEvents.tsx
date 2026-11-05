
import { isRsvpClosed } from '../lib/holidayRsvps';
import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, ExternalLink, RotateCcw } from 'lucide-react';
import { UPCOMING_EVENTS as FALLBACK_EVENTS } from '../data';
import { supabase } from '../lib/supabase';
import { dedupeEvents, normalizeEvent } from '../lib/events';
import type { ChurchEvent } from '../types';
import { EventDetailModule } from './EventDetailModule';

export const UpcomingEvents: React.FC<{ heading?: string }> = ({ heading = 'Upcoming Events' }) => {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
    // Pick up events added or deleted in the Vault while Connect sat open in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchEvents(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const fetchEvents = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('starts_at', today)
        .order('starts_at', { ascending: true })
        .limit(10);

      if (error) throw error;

      const normalized = dedupeEvents((data || []).map(normalizeEvent));
      setEvents(normalized);
    } catch (err) {
      console.error('Error fetching events:', err);
      setEvents(FALLBACK_EVENTS.map((u) => normalizeEvent({ ...u, title: u.title })));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchEvents(true);
  };

  const getMonth = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const getDay = (d: string) => new Date(d).toLocaleDateString('en-US', { day: 'numeric' });
  const getTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink tracking-tight">{heading}</h2>
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className={`h-10 w-10 inline-flex items-center justify-center bg-white rounded-xl border border-gray-100 shadow-card text-burgundy hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-label="Refresh events"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-5 animate-pulse">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex-shrink-0" />
              <div className="space-y-2 flex-grow">
                <div className="h-2 w-20 bg-gray-50 rounded" />
                <div className="h-4 w-40 bg-gray-50 rounded" />
                <div className="h-2 w-24 bg-gray-50 rounded" />
              </div>
            </div>
          ))
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              onClick={() => {
                setSelectedEvent(event);
                setIsDetailOpen(true);
              }}
              className="bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-md transition-all duration-300 overflow-hidden group cursor-pointer"
            >
              {event.image_url && (
                <div className="w-full overflow-hidden relative bg-[#1A1A1A]">
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-auto max-h-48 object-contain group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-3 px-4">
                    <p className="text-white text-sm font-bold drop-shadow">{event.title}</p>
                  </div>
                </div>
              )}

              <div className="p-2 flex items-center gap-5">
                <div className="w-14 h-14 bg-burgundy rounded-xl flex flex-col items-center justify-center flex-shrink-0 ml-2">
                  <span className="text-xs font-bold text-white/80 tracking-wide leading-none mb-0.5">
                    {getMonth(event.starts_at || event.date || '')}
                  </span>
                  <span className="text-2xl font-black text-white leading-none">
                    {getDay(event.starts_at || event.date || '')}
                  </span>
                </div>

                <div className="flex-grow pr-4 py-2">
                  {!event.image_url && (
                    <h3 className="font-semibold text-ink text-[15px] leading-snug transition-colors group-hover:text-burgundy mb-0.5">
                      {event.title}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-ink-muted text-sm font-semibold">
                      {getTime(event.starts_at || event.date || '')}
                      {event.end_time ? ` – ${event.end_time}` : ''}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">{event.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    {event.location && (
                      <div className="flex items-center gap-1 text-ink-soft text-sm min-w-0">
                        <MapPin size={14} className="text-gray-500 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.rsvp_enabled && event.rsvp_url && !isRsvpClosed(event.rsvp_close_at) ? (
                      <a
                        href={event.rsvp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 min-h-[36px] text-sm font-bold text-white bg-burgundy px-3.5 rounded-full hover:bg-burgundy-dark transition-colors active:scale-95 shrink-0"
                      >
                        RSVP <ExternalLink size={13} />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {!loading && events.length === 0 && (
          <div className="bg-white rounded-2xl p-10 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-500 mb-4">
              <Calendar size={24} />
            </div>
            <p className="text-[15px] font-semibold text-ink">No upcoming events</p>
            <p className="text-sm text-ink-soft mt-1">New gatherings show up here as soon as they're on the calendar.</p>
          </div>
        )}
      </div>

      <EventDetailModule
        event={selectedEvent}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
};
