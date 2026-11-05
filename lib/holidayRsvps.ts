/**
 * Holiday RSVPs (PLCC Vault → Events & Check-In → Holiday RSVPs · 2026).
 * Mirrors the Vault Fellowship Event Kit (api/_utils/fellowshipEventConfig.ts):
 * same event ids, dates and RSVP close times. The sign-up form itself — household,
 * guests, allergy/injury consents, Pledge vs Pay Now — stays on Vault; Connect
 * links to it. Vault uses hash routes, so links must include `/#/`.
 */
import { VAULT_PUBLIC_ORIGIN } from './staffVaultAccess';

export type HolidayRsvp = {
  eventId: string;
  /** Calendar name on Vault */
  name: string;
  /** Short, member-facing title for cards */
  title: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  /** RSVP closes (ISO with offset) — matches Vault kit rsvpCloseAt */
  rsvpCloseAt: string;
  /** When Connect starts featuring the sign-up on Home */
  featureFrom: string;
  blurb: string;
  cta: string;
  emoji: string;
  /** Dinner menu (allergy reference) — mirrors Vault THANKSGIVING_2026_MENU. */
  menu?: string[];
};

/** PLCC Table of Thanksgiving 2026 menu — same list Vault shows next to allergies. */
export const THANKSGIVING_2026_MENU: string[] = [
  'Matooke',
  'Rice pillawo',
  'Posho',
  'Sweet potatoes/Yams',
  'Cassava/Irish',
  'Chapats',
  'Beef stew/sauce',
  'Chicken sauce',
  'Peanut sauce',
  'Bean/peas',
  'Vegetables',
  'Turkey',
  'Pasta salad',
  'Mac & cheese',
  'Corn',
  'Apple Pie',
  'Mandazi',
  'Cake',
];

// The live Vault event (moved to Sun Dec 6). The old built-in id a1b2c3d4-…-202611221400 was deleted.
export const THANKSGIVING_2026_EVENT_ID = '86ac9498-ee56-4c6a-baae-079832b0ea73';
export const MARRIEDS_DINNER_2026_EVENT_ID = 'a1b2c3d4-e5f6-4789-a012-202612121800';

export const HOLIDAY_RSVPS: HolidayRsvp[] = [
  {
    eventId: THANKSGIVING_2026_EVENT_ID,
    name: 'Join us at PLCC Table of Thanksgiving 2026',
    title: 'Thanksgiving Dinner',
    date: '2026-12-06',
    dateLabel: 'Sunday, December 6',
    timeLabel: '12:00 PM – 7:00 PM',
    location: '2nd Floor Sanctuary',
    rsvpCloseAt: '2026-12-04T23:59:00-05:00',
    featureFrom: '2026-10-01T00:00:00-04:00',
    blurb:
      'Join us at the PLCC Table of Thanksgiving. Sign up so we know how many people to plan for and also care for any allergies.',
    cta: 'Sign up for Thanksgiving Dinner',
    emoji: '🦃',
    menu: THANKSGIVING_2026_MENU,
  },
  {
    eventId: MARRIEDS_DINNER_2026_EVENT_ID,
    name: 'The Marrieds Dinner 2026',
    title: 'The Marrieds Dinner',
    date: '2026-12-12',
    dateLabel: 'Saturday, December 12',
    timeLabel: '6:00 PM – 9:00 PM',
    location: '2nd Floor Sanctuary',
    rsvpCloseAt: '2026-12-05T23:59:00-05:00',
    featureFrom: '2026-11-17T00:00:00-05:00',
    blurb: 'An evening for married couples. Sign up so we can set your table.',
    cta: 'Sign up for the Marrieds Dinner',
    emoji: '💍',
  },
];

export function holidayRsvpById(eventId: string | null | undefined): HolidayRsvp | null {
  if (!eventId) return null;
  return HOLIDAY_RSVPS.find((r) => r.eventId === eventId) || null;
}

/** Vault public sign-up page for any RSVP-enabled calendar event. */
export function vaultEventRsvpUrl(eventId: string): string {
  return `${VAULT_PUBLIC_ORIGIN}/#/events/${encodeURIComponent(eventId)}/rsvp`;
}

export function isRsvpClosed(rsvpCloseAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!rsvpCloseAt) return false;
  const t = Date.parse(rsvpCloseAt);
  return Number.isFinite(t) && now.getTime() >= t;
}

/** "Mon, Nov 16" in church time. */
export function formatRsvpBy(rsvpCloseAt: string): string {
  return new Date(rsvpCloseAt).toLocaleDateString('en-US', {
    timeZone: 'Africa/Kampala',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Whole days left to sign up (0 on the last day). */
export function daysLeftToRsvp(rsvpCloseAt: string, now: Date = new Date()): number {
  const ms = Date.parse(rsvpCloseAt) - now.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

/** The holiday sign-up to feature on Home right now (nearest open one), if any. */
export function featuredHolidayRsvp(
  now: Date = new Date(),
  opts?: { removedIds?: ReadonlySet<string> }
): HolidayRsvp | null {
  const t = now.getTime();
  const removed = opts?.removedIds;
  return (
    [...HOLIDAY_RSVPS]
      .filter((r) => !removed?.has(r.eventId))
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((r) => t >= Date.parse(r.featureFrom) && !isRsvpClosed(r.rsvpCloseAt, now)) || null
  );
}

/**
 * Vault links stored without the hash (e.g. https://plcc-opal.vercel.app/events/:id/rsvp)
 * open the Vault home page. Insert `/#` for Vault-origin links; leave others alone.
 */
export function normalizeVaultRsvpLink(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/#/')) return `${VAULT_PUBLIC_ORIGIN}${raw}`;
  if (!raw.startsWith(VAULT_PUBLIC_ORIGIN)) return raw;
  const rest = raw.slice(VAULT_PUBLIC_ORIGIN.length);
  if (rest.startsWith('/#/') || rest === '' || rest === '/') return raw;
  return `${VAULT_PUBLIC_ORIGIN}/#${rest.startsWith('/') ? rest : `/${rest}`}`;
}
