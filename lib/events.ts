import type { ChurchEvent } from '../types';
import { VAULT_PUBLIC_ORIGIN } from './staffVaultAccess';
import {
  holidayRsvpById,
  normalizeVaultRsvpLink,
  vaultEventRsvpUrl as holidayVaultRsvpUrl,
} from './holidayRsvps';

export const FELLOWSHIP_COOKOUT_ID = 'a1b2c3d4-e5f6-4789-a012-202609201400';

/** Cookout cover image from PLCC Canaan / Supabase storage */
export const FELLOWSHIP_COOKOUT_IMAGE =
  'https://yrpwdrioomdihjlmcfnu.supabase.co/storage/v1/object/public/avatars/events/1787686538179-96c4zkjnj64.jpg';

export const FELLOWSHIP_COOKOUT_LOCAL_IMAGE = '/events/fellowship-cookout.jpg';

/** Full cookout signup (household, children, allergy consents) lives in PLCC Canaan (hash routes). */
export const FELLOWSHIP_COOKOUT_RSVP_URL = `${VAULT_PUBLIC_ORIGIN}/#/fellowship-cookout`;

const COOKOUT_DESCRIPTION =
  'Join us for food, fellowship, and community as we celebrate together on the church grounds. Sign up so we know how many plates to prepare and how to care for children and allergies.';

type RawEvent = Record<string, unknown>;

function parseEventDateTime(date?: string, time?: string): string | null {
  if (!date) return null;
  const match = (time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return `${date}T14:00:00`;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${date}T${hh}:${mm}:00`;
}

function isCookoutEvent(raw: RawEvent): boolean {
  const id = String(raw.id || '');
  const name = String(raw.name || raw.title || '').toLowerCase();
  return id === FELLOWSHIP_COOKOUT_ID || name.includes('cookout') || name.includes('fellowship');
}

/** Vault Fellowship Event Kit ids (cookout + Holiday RSVPs) — RSVP on unless Vault turns it off. */
function isKnownFellowshipKitId(id: string): boolean {
  return id === FELLOWSHIP_COOKOUT_ID || Boolean(holidayRsvpById(id));
}

/** Vault public signup page for a calendar event (`/#/events/:id/rsvp`). */
export function vaultEventRsvpUrl(eventId: string): string {
  return holidayVaultRsvpUrl(eventId);
}

/**
 * Mirror Vault runtimeConfigFromDbEvent enablement:
 * explicit true, or null flags on a known fellowship kit id.
 */
export function resolveRsvpEnabled(raw: RawEvent): boolean {
  if (raw.rsvp_enabled === true || raw.rsvpEnabled === true) return true;
  if (raw.rsvp_enabled === false || raw.rsvpEnabled === false) return false;
  const id = String(raw.id || '');
  return isKnownFellowshipKitId(id);
}

/** Map Supabase/Vault event rows to Connect UI shape */
export function normalizeEvent(raw: RawEvent): ChurchEvent {
  const id = String(raw.id || '');
  const title = String(raw.title || raw.name || 'Event');
  const date = raw.date ? String(raw.date) : undefined;
  const time = raw.time ? String(raw.time) : undefined;
  const endTime = raw.end_time ? String(raw.end_time) : undefined;

  let startsAt = raw.starts_at ? String(raw.starts_at) : undefined;
  const parsed = parseEventDateTime(date, time);
  if (parsed) {
    const eventDay = date ? new Date(date).toDateString() : '';
    const startsDay = startsAt ? new Date(startsAt).toDateString() : '';
    if (!startsAt || eventDay !== startsDay) {
      startsAt = parsed;
    }
  }

  let description = raw.description ? String(raw.description) : undefined;
  let location = raw.location ? String(raw.location) : undefined;
  let imageUrl = (raw.image_url || raw.imageUrl) ? String(raw.image_url || raw.imageUrl) : undefined;

  if (id === FELLOWSHIP_COOKOUT_ID || title === 'Fellowship Cookout') {
    location = location || 'Church grounds';
    description = COOKOUT_DESCRIPTION;
    imageUrl = imageUrl || FELLOWSHIP_COOKOUT_IMAGE || FELLOWSHIP_COOKOUT_LOCAL_IMAGE;
    if (date === '2026-09-20' && time) {
      startsAt = parseEventDateTime(date, time) || startsAt;
    }
  } else if (isCookoutEvent(raw) && !imageUrl) {
    imageUrl = FELLOWSHIP_COOKOUT_IMAGE || FELLOWSHIP_COOKOUT_LOCAL_IMAGE;
  }

  if (description?.includes('/#/fellowship-cookout') || description?.includes('/fellowship-cookout')) {
    description = COOKOUT_DESCRIPTION;
  }

  // Holiday RSVPs: Vault seeds staff-facing text ("Sign up at /#/thanksgiving-rsvp").
  const holiday = holidayRsvpById(id);
  if (holiday) {
    if (!description || /\/#?\/?[a-z-]*rsvp|sign up at/i.test(description)) {
      description = holiday.blurb;
    }
    location = location || holiday.location;
  }

  const rsvpEnabled = resolveRsvpEnabled(raw);

  let rsvpUrl: string | undefined;
  if (rsvpEnabled) {
    if (raw.rsvp_url) {
      rsvpUrl = normalizeVaultRsvpLink(String(raw.rsvp_url));
    } else if (id === FELLOWSHIP_COOKOUT_ID || title === 'Fellowship Cookout') {
      rsvpUrl = FELLOWSHIP_COOKOUT_RSVP_URL;
    } else if (id) {
      rsvpUrl = vaultEventRsvpUrl(id);
    }
  }

  return {
    id,
    title,
    description,
    location,
    date,
    time,
    end_time: endTime,
    starts_at: startsAt || parsed || new Date().toISOString(),
    image_url: imageUrl,
    rsvp_enabled: rsvpEnabled,
    rsvp_url: rsvpUrl,
    rsvp_close_at: raw.rsvp_close_at ? String(raw.rsvp_close_at) : holiday?.rsvpCloseAt,
    type: raw.type ? String(raw.type) : undefined,
  };
}

export function dedupeEvents(events: ChurchEvent[]): ChurchEvent[] {
  const cookoutByDate = new Map<string, ChurchEvent>();
  const others: ChurchEvent[] = [];

  for (const event of events) {
    const isCookout =
      event.id === FELLOWSHIP_COOKOUT_ID || event.title.toLowerCase().includes('cookout');

    if (isCookout && event.date) {
      const existing = cookoutByDate.get(event.date);
      if (!existing || event.id === FELLOWSHIP_COOKOUT_ID) {
        cookoutByDate.set(event.date, event);
      }
    } else {
      others.push(event);
    }
  }

  return [...others, ...cookoutByDate.values()].sort(
    (a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime()
  );
}

export function formatEventDateTime(startsAt: string, endTime?: string): string {
  const start = new Date(startsAt);
  const when = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (endTime) {
    return `${when} – ${endTime}`;
  }

  return when;
}
