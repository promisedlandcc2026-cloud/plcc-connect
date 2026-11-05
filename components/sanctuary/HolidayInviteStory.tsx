/**
 * Holiday sign-up as a story (Thanksgiving first, then the Marrieds Dinner):
 * the invitation, then how sign-up works. The form itself stays on PLCC Vault.
 */
import React, { useState } from 'react';
import { Clock, ExternalLink, Leaf, Share2 } from 'lucide-react';
import {
  daysLeftToRsvp,
  formatRsvpBy,
  vaultEventRsvpUrl,
  type HolidayRsvp,
} from '../../lib/holidayRsvps';
import { whatsAppShareUrl } from '../../lib/todayStories';
import type { StorySlide } from './StoryViewer';

const BG = 'radial-gradient(110% 60% at 20% 0%, #B4471A 0%, #1c3429 38%, #0d1914 78%, #0e1512 100%)';

function shortDate(rsvp: HolidayRsvp): { weekday: string; day: string } {
  const [weekday, rest] = rsvp.dateLabel.split(', ');
  const [month, day] = (rest || '').split(' ');
  return { weekday: (weekday || '').toUpperCase(), day: `${(month || '').slice(0, 3)} ${day || ''}`.trim() };
}

function titleParts(rsvp: HolidayRsvp): { lead: string; accent: string } {
  if (/thanksgiving/i.test(rsvp.name)) return { lead: 'The PLCC Table of', accent: 'Thanksgiving' };
  const words = rsvp.title.split(' ');
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] };
}

const Menu: React.FC<{ items: string[] }> = ({ items }) => {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.filter((i) => /turkey|matooke|pillawo|chapat|mac|mandazi|apple/i.test(i)).slice(0, 7);
  const more = items.length - shown.length;
  return (
    <section aria-label="On the table" className="mt-5">
      <h3 className="mb-2.5 px-1 text-sm font-bold text-cream/90">On the table</h3>
      <ul className="flex flex-wrap gap-2">
        {shown.map((item) => (
          <li key={item} className="rounded-[14px] bg-cream/[0.12] px-3 py-2 text-[13px] font-semibold">
            {item}
          </li>
        ))}
        {more > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="min-h-[36px] rounded-[14px] border border-dashed border-[#F2D98A]/60 px-3 text-[13px] font-bold text-[#F2D98A]"
            >
              + {more} more
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
};

export function holidayInviteSlides(rsvp: HolidayRsvp, now: Date = new Date()): StorySlide[] {
  const { weekday, day } = shortDate(rsvp);
  const { lead, accent } = titleParts(rsvp);
  const days = daysLeftToRsvp(rsvp.rsvpCloseAt, now);
  const href = vaultEventRsvpUrl(rsvp.eventId);
  const share = whatsAppShareUrl(
    `${rsvp.name} — ${rsvp.dateLabel}, ${rsvp.timeLabel}, ${rsvp.location}. Sign up here: ${href}`
  );

  const actions = (
    <div className="mt-auto px-5 pb-2 pt-5">
      <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-cream/90">
        <Clock size={16} className="text-[#F2D98A]" aria-hidden />
        RSVP by {formatRsvpBy(rsvp.rsvpCloseAt)} · {days === 0 ? 'last day' : `${days} day${days === 1 ? '' : 's'} left`}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-leaf text-[17px] font-extrabold text-wine shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
      >
        Save my family’s seats <ExternalLink size={16} aria-hidden />
      </a>
      <a
        href={share}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] border border-cream/40 text-[15px] font-bold text-cream"
      >
        <Share2 size={18} aria-hidden /> Invite family on WhatsApp
      </a>
    </div>
  );

  return [
    {
      key: `${rsvp.eventId}-invite`,
      background: BG,
      content: (
        <>
          <Leaf
            aria-hidden
            className="pointer-events-none absolute -right-12 top-4 z-0 h-56 w-56 text-[#F2D98A] opacity-[0.16]"
            strokeWidth={0.5}
          />
          <div className="relative min-h-0 flex-1 overflow-y-auto no-scrollbar px-6 pt-8">
            <p className="text-[13px] font-extrabold tracking-[0.16em] text-[#F2D98A]">YOU’RE INVITED</p>
            <h2 className="mt-3 font-display text-[44px] leading-[1.02] font-bold tracking-[-0.01em]">
              {lead} <span className="italic text-[#F2D98A]">{accent}</span>
            </h2>
            <p className="mt-4 max-w-[300px] text-base leading-relaxed text-cream/90">{rsvp.blurb}</p>
            <dl className="mt-6 grid grid-cols-3 gap-2">
              <div className="rounded-[18px] border border-[#F2D98A]/25 bg-black/25 p-3">
                <dt className="text-xs font-bold text-[#F2D98A]">{weekday}</dt>
                <dd className="mt-1 font-display text-2xl font-bold leading-none">{day}</dd>
              </div>
              <div className="rounded-[18px] border border-[#F2D98A]/25 bg-black/25 p-3">
                <dt className="text-xs font-bold text-[#F2D98A]">TIME</dt>
                <dd className="mt-1 text-[15px] font-bold leading-tight">{rsvp.timeLabel.replace(':00', '').replace(':00', '')}</dd>
              </div>
              <div className="rounded-[18px] border border-[#F2D98A]/25 bg-black/25 p-3">
                <dt className="text-xs font-bold text-[#F2D98A]">WHERE</dt>
                <dd className="mt-1 text-sm font-bold leading-tight">{rsvp.location}</dd>
              </div>
            </dl>
            {rsvp.menu?.length ? <Menu items={rsvp.menu} /> : null}
          </div>
          {actions}
        </>
      ),
    },
    {
      key: `${rsvp.eventId}-how`,
      background: BG,
      content: (
        <>
          <div className="relative min-h-0 flex-1 overflow-y-auto no-scrollbar px-6 pt-8">
            <p className="text-[13px] font-extrabold tracking-[0.16em] text-[#F2D98A]">HOW SIGN-UP WORKS</p>
            <h2 className="mt-3 font-display text-[36px] leading-[1.06] font-bold">
              Two minutes, <span className="italic text-[#F2D98A]">one form.</span>
            </h2>
            <ol className="mt-6 space-y-3">
              {[
                ['Your household', 'Who’s coming from home, plus any guests.'],
                ['Allergies', 'So the kitchen can care for everyone at the table.'],
                ...(/thanksgiving/i.test(rsvp.name) ? [['Pledge or pay now', 'Choose what works for your family.']] : []),
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 rounded-[18px] bg-black/25 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf text-sm font-extrabold text-wine">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold">{t}</span>
                    <span className="block text-sm text-cream/85">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-cream/80">The form opens on PLCC Vault, the church’s sign-up site.</p>
          </div>
          {actions}
        </>
      ),
    },
  ];
}
