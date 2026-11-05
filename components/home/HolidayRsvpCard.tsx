/**
 * Featured holiday sign-up (Thanksgiving Dinner, then the Marrieds Dinner).
 * Shows from the feature date until RSVP closes, then disappears on its own.
 * The form lives on PLCC Canaan (household, guests, allergies, Pledge vs Pay Now).
 */
import React from 'react';
import { CalendarDays, Clock, ExternalLink, MapPin } from 'lucide-react';
import { daysLeftToRsvp, formatRsvpBy, vaultEventRsvpUrl } from '../../lib/holidayRsvps';
import { useFeaturedHolidayRsvp } from '../../lib/holidayRsvpLive';

export const HolidayRsvpCard: React.FC<{ now?: Date }> = ({ now }) => {
  const rsvp = useFeaturedHolidayRsvp(now);
  if (!rsvp) return null;
  const days = daysLeftToRsvp(rsvp.rsvpCloseAt, now);
  const urgency =
    days === 0 ? 'Last day to sign up' : days <= 7 ? `${days} day${days === 1 ? '' : 's'} left to sign up` : null;

  return (
    <section
      id="holiday-rsvp"
      aria-labelledby="holiday-rsvp-title"
      className="scroll-mt-24 rounded-3xl overflow-hidden border border-gray-100 bg-white shadow-sm"
    >
      <div className="px-5 pt-5 pb-4 text-white" style={{ background: 'var(--season-accent, #1d372c)' }}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-90">Sign-ups are open</p>
        <h2 id="holiday-rsvp-title" className="mt-1 text-2xl font-black leading-tight font-sans">
          <span aria-hidden>{rsvp.emoji} </span>
          {rsvp.title}
        </h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        <ul className="space-y-1.5 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <CalendarDays size={16} className="text-burgundy shrink-0" aria-hidden />
            {rsvp.dateLabel}
          </li>
          <li className="flex items-center gap-2">
            <Clock size={16} className="text-burgundy shrink-0" aria-hidden />
            {rsvp.timeLabel}
          </li>
          <li className="flex items-center gap-2">
            <MapPin size={16} className="text-burgundy shrink-0" aria-hidden />
            {rsvp.location}
          </li>
        </ul>
        <p className="text-sm text-gray-600 leading-relaxed">{rsvp.blurb}</p>
        <a
          href={vaultEventRsvpUrl(rsvp.eventId)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[52px] rounded-2xl bg-burgundy text-white font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          {rsvp.cta}
          <ExternalLink size={16} aria-hidden />
        </a>
        <p className="text-center text-xs font-semibold text-gray-500">
          RSVP by {formatRsvpBy(rsvp.rsvpCloseAt)}
          {urgency ? <span className="text-burgundy"> · {urgency}</span> : null}
        </p>
      </div>
    </section>
  );
};
