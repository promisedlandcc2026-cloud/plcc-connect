import React, { useEffect, useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { EventDetailModule } from '../EventDetailModule';
import { MemberHomeSection } from './MemberHomeSection';
import { ErrorState, LoadingState } from '../ui/States';
import { fetchMemberHomeEvents } from '../../lib/memberHomeData';
import {
  filterUpcomingEvents,
  formatEventDateShort,
  formatEventTime,
} from '../../lib/memberHomeEvents';
import { pickNextUp } from '../../lib/nextUp';
import type { ChurchEvent } from '../../types';

export const MemberHomeUpcoming: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const all = await fetchMemberHomeEvents({ limit: 12 });
      // The header's Next up card already shows the very next gathering — don't list it twice.
      const next = pickNextUp(all);
      const skipId = next.kind === 'event' ? String(next.event.id) : null;
      setEvents(filterUpcomingEvents(all.filter((e) => String(e.id) !== skipId), { limit: 3 }));
    } catch {
      // A quiet refresh that fails keeps what is already on screen.
      if (!silent) {
        setError('Could not load upcoming events.');
        setEvents([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Pick up events added or deleted in the Vault while Connect sat open in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!loading && !error && events.length === 0) {
    return <section id="events" className="scroll-mt-24 sr-only" aria-hidden />;
  }

  return (
    <MemberHomeSection
      id="events"
      title="Coming up"
      action={{ to: '/events', label: 'All events' }}
    >
      {loading ? <LoadingState message="Loading events…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setSelected(event)}
                className="w-full text-left flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 shadow-sm min-h-[64px] active:scale-[0.99] transition-transform"
              >
                <div className="w-12 h-12 rounded-xl bg-burgundy text-white flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider opacity-80">
                    {formatEventDateShort(event.starts_at, event.date).split(' ')[1] || ''}
                  </span>
                  <span className="text-lg font-black leading-none">
                    {event.starts_at
                      ? new Date(event.starts_at).getDate()
                      : event.date
                        ? new Date(event.date).getDate()
                        : '—'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1A1A1A] truncate">{event.title}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={11} aria-hidden />
                    {formatEventDateShort(event.starts_at, event.date)}
                    {' · '}
                    {formatEventTime(event.starts_at, event.time)}
                  </p>
                  {event.location ? (
                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                      <MapPin size={11} aria-hidden />
                      {event.location}
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <EventDetailModule
        event={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </MemberHomeSection>
  );
};
