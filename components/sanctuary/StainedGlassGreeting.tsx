/**
 * Sanctuary greeting: date, "Good morning, <name>." in Playfair with the name in
 * gold italic, and the season chip — over a soft stained-glass arch whose glow
 * follows the season accent (CSS: .awc-stained-glass).
 */
import React from 'react';
import { CloudRain, Leaf, Snowflake, Sprout, Sun } from 'lucide-react';
import { useFeaturedHolidayRsvp } from '../../lib/holidayRsvpLive';
import { seasonChipLabel } from '../../lib/sanctuary';
import { usePublishedSeason } from '../season/SeasonThemeProvider';

const SEASON_ICON = { fall: Leaf, winter: Snowflake, spring: Sprout, summer: Sun } as const;

/** Decorative arch + glow. Must sit inside a positioned parent. */
export const StainedGlass: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div className="awc-stained-glass">
      <div className="awc-stained-glass__glow" />
      <svg width="300" height="360" viewBox="0 0 300 360" className="absolute inset-0 opacity-25">
        <path d="M10 360 V150 A140 140 0 0 1 290 150 V360" fill="none" stroke="#F2D98A" strokeWidth="1.5" />
        <path d="M40 360 V160 A110 110 0 0 1 260 160 V360" fill="none" stroke="#F2D98A" strokeWidth="1" />
        <path d="M150 40 V360 M40 220 H260 M74 110 L226 300 M226 110 L74 300" fill="none" stroke="#F2D98A" strokeWidth="0.75" />
      </svg>
    </div>
  </div>
);

function todayLabel(now = new Date()): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(', ', ' · ');
}

/**
 * `greeting` comes from memberHomeGreeting(): "Good morning, Jerless" or
 * "Welcome back". The part after the comma is set in gold italic.
 */
export const StainedGlassGreeting: React.FC<{
  greeting: string;
  now?: Date;
  /** Visitor Home keeps its own sr-only h1, so the greeting renders as a <p>. */
  as?: 'h1' | 'p';
  tagline?: string;
}> = ({ greeting, now = new Date(), as: Heading = 'h1', tagline }) => {
  const { theme } = usePublishedSeason();
  const comma = greeting.lastIndexOf(', ');
  const lead = comma > 0 ? greeting.slice(0, comma) : greeting;
  const name = comma > 0 ? greeting.slice(comma + 2) : null;
  const holiday = useFeaturedHolidayRsvp(now);
  // Uganda: rainy / dry seasons (with Kampala's weather when it loads), not US fall.
  const uganda = theme.id === 'rainy' || theme.id === 'dry';
  const SeasonIcon = uganda
    ? theme.id === 'rainy'
      ? CloudRain
      : Sun
    : SEASON_ICON[theme.season as keyof typeof SEASON_ICON] || Leaf;
  const chip = seasonChipLabel({
    season: uganda ? theme.id : theme.season,
    weatherLabel: uganda ? theme.weatherLabel ?? null : null,
    holidayTitle: holiday?.title ?? null,
    holidayDate: holiday?.date ?? null,
    now,
  });

  return (
    <div className="relative">
      <p className="text-sm font-medium text-cream/80">{todayLabel(now)}</p>
      <Heading className="mt-1.5 font-display text-[40px] xs:text-[42px] leading-[1.04] font-bold tracking-[-0.01em] text-cream">
        {name ? (
          <>
            {lead},
            <br />
            <span className="italic text-leaf">{name}.</span>
          </>
        ) : (
          <>
            {lead}
            <span className="text-leaf">.</span>
          </>
        )}
      </Heading>
      {tagline ? <p className="mt-2 text-[15px] font-medium text-cream/85">{tagline}</p> : null}
      {theme.id !== 'brand' ? (
        <p className="awc-season-chip mt-3.5 inline-flex max-w-full items-center gap-2 min-h-[30px] rounded-full border border-leaf/25 px-3 py-1 text-[13px] font-semibold text-cream">
          <SeasonIcon size={14} className="shrink-0 text-[#F2D98A]" aria-hidden />
          <span className="min-w-0">{chip}</span>
        </p>
      ) : null}
      {theme.greeting ? <p className="mt-2 text-sm font-bold text-leaf">{theme.greeting}</p> : null}
    </div>
  );
};
