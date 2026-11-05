import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SectionHeader } from '../ui/SectionHeader';
import { ListGroup, ListRow } from '../ui/ListRow';
import { PWAPrompt } from '../PWAPrompt';
import { PhoneAlertsCard } from '../PhoneAlertsCard';
import { MemberHomeDaily } from './MemberHomeDaily';
import { WatchLive } from '../WatchLive';
import { Church } from 'lucide-react';
import { Footer } from '../Footer';
import { SeasonHeroLayer } from '../season/SeasonHeroLayer';
import { HolidayRsvpCard } from '../home/HolidayRsvpCard';
import { MemberHomeHeader } from './MemberHomeHeader';
import { SundayModeBanner } from './SundayModeBanner';
import { MemberHomeLeaderboard } from './MemberHomeLeaderboard';
import { MemberHomeUpcoming } from './MemberHomeUpcoming';
import { MemberHomeCommunity } from './MemberHomeCommunity';
import { MemberHomeAnnouncements } from './MemberHomeAnnouncements';
import { MemberHomeVaultNews } from './MemberHomeVaultNews';
import { MemberHomePrayer } from './MemberHomePrayer';
import { MemberHomeSermon } from './MemberHomeSermon';
import { MemberHomeCelebrations } from './MemberHomeCelebrations';

const SCROLL_SECTIONS = new Set(['vault-news', 'leaderboard', 'holiday-rsvp', 'watch-live']);

/**
 * Approved-member Home (Sanctuary redesign).
 * Top (wine shell): stained-glass greeting, Next-up ticket, Today stories and
 * four quick actions — or, on Sunday while service is live, the in-service view.
 * Feed, in groups: time-sensitive nudges → Today (devotional) → This week
 * (events, announcements) → Church family (birthdays, community, prayer) →
 * Watch (video + latest sermon in one place) → Canaan News → Leaderboard.
 * Empty sections hide themselves; unread count lives on the bell only.
 * Each feed section loads independently so one failure cannot blank the page.
 */
export const MemberHome: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (!section || !SCROLL_SECTIONS.has(section)) return;
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, [location.search]);
  const [live, setLive] = useState(false);

  return (
  <div className="awc-home-shell" data-mode={live ? 'live' : 'weekday'}>
    <SeasonHeroLayer />
    <MemberHomeHeader onLiveChange={setLive} />

    <main className="relative mt-7 bg-cream text-ink rounded-t-[30px] px-5 pt-5 space-y-9 pb-[calc(8.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.22)]">
      <div className="mx-auto h-1 w-10 rounded-full bg-[#D8CCBF]" aria-hidden />
      {/* Nudges + time-sensitive cards (each hides itself when it has nothing to say). */}
      <PWAPrompt />
      <PhoneAlertsCard variant="nudge" />
      <SundayModeBanner />
      <HolidayRsvpCard />

      {/* Today */}
      <MemberHomeDaily />

      {/* This week at PLCC */}
      <MemberHomeUpcoming />
      <MemberHomeAnnouncements />

      {/* Church family */}
      <MemberHomeCelebrations />
      <MemberHomeCommunity />
      <MemberHomePrayer />

      {/* Sunday's message: the video player with the sermon underneath — one card, one Watch. */}
      <section id="watch-live" className="scroll-mt-24 space-y-2" aria-labelledby="watch-live-heading">
        <SectionHeader title="Watch" id="watch-live-heading" className="" />
        <WatchLive />
        <MemberHomeSermon />
      </section>

      <MemberHomeVaultNews />
      <MemberHomeLeaderboard />

      <section id="ministries" className="scroll-mt-24 space-y-2" aria-labelledby="member-ministries-heading">
        <SectionHeader title="Ministries" id="member-ministries-heading" className="" />
        <ListGroup>
          <ListRow
            to="/ministries"
            title="Ministry Hubs"
            subtitle="Enter a ministry to see teams, community, and chat."
            icon={Church}
          />
        </ListGroup>
      </section>

      <section id="connect" className="scroll-mt-24 sr-only" aria-hidden>
        {/* Anchor preserved for More → Connect Card deep links if needed later */}
      </section>

      <Footer />
    </main>
  </div>
  );
};
