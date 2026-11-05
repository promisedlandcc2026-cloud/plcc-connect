/**
 * Shared public church-data helpers for Connect (visitor + member surfaces).
 * Mirrors proven PrayerWall / Announcements query shapes — dual-schema safe.
 */

import { supabasePublic } from './supabasePublic';
import { dedupeEvents, normalizeEvent } from './events';
import type { ChurchEvent } from '../types';
import { localDayBounds } from './memberHomeEvents';
import {
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
  resolveLatestVideoUrl,
} from './youtube';
import { supabase } from './supabase';

/** Fetch a small upcoming window of events (includes today + near future). */
export async function fetchMemberHomeEvents(opts?: {
  limit?: number;
}): Promise<ChurchEvent[]> {
  const limit = opts?.limit ?? 12;
  const { start } = localDayBounds();
  // Events public-read policies do not subquery users — session client is fine
  // and matches UpcomingEvents. Keep behavior unchanged for working section.
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('starts_at', start.toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return dedupeEvents((data || []).map((row) => normalizeEvent(row as Record<string, unknown>)));
}

// —— Announcements ————————————————————————————————————————————————

export type HomeAnnouncement = {
  id: string;
  title: string;
  summary: string;
  dateLabel: string;
  imageUrl: string | null;
  raw: Record<string, unknown>;
};

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
}

function friendlyDate(value: string): string {
  if (!value) return '';
  // A bare YYYY-MM-DD is a calendar day, not midnight UTC (which shows as the day before here).
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Normalize both Connect sync schema (date/description) and Vault schema (content/event_date). */
export function normalizeAnnouncementRow(row: unknown): HomeAnnouncement {
  const item = asRecord(row);
  const created = item.created_at ? String(item.created_at) : '';
  const eventDate = item.event_date ? String(item.event_date) : '';
  const legacyDate = item.date ? String(item.date) : '';
  // "Tue, Oct 27" — same style as event dates elsewhere on Home.
  const dateLabel = friendlyDate(eventDate) || friendlyDate(created) || friendlyDate(legacyDate) || eventDate || legacyDate;
  const summary = String(item.content || item.description || '');
  const imageUrl = item.image_url || item.imageUrl
    ? String(item.image_url || item.imageUrl)
    : null;
  return {
    id: String(item.id ?? ''),
    title: String(item.title || 'Announcement'),
    summary,
    dateLabel,
    imageUrl,
    raw: item,
  };
}

/**
 * Same table/query shape as components/Announcements.tsx + PrayerWall public reads.
 * Uses sessionless anon client so signed-in Member Home is not broken by
 * authenticated admin RLS policies that subquery public.users.
 */
export async function fetchMemberHomeAnnouncements(opts?: {
  limit?: number;
}): Promise<HomeAnnouncement[]> {
  const limit = opts?.limit ?? 3;

  const primary = await supabasePublic
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return (primary.data || []).map(normalizeAnnouncementRow);
  }

  console.error('[member-home announcements]', primary.error.code, primary.error.message);

  // Schema drift only — not used to hide RLS failures when anon also fails.
  const byEvent = await supabasePublic
    .from('announcements')
    .select('*')
    .order('event_date', { ascending: false })
    .limit(limit);

  if (!byEvent.error) {
    return (byEvent.data || []).map(normalizeAnnouncementRow);
  }

  console.error('[member-home announcements]', byEvent.error.code, byEvent.error.message);

  const unordered = await supabasePublic.from('announcements').select('*').limit(limit);
  if (unordered.error) {
    console.error('[member-home announcements]', unordered.error.code, unordered.error.message);
    throw unordered.error;
  }
  return (unordered.data || []).map(normalizeAnnouncementRow);
}

// —— Prayer (public only) ——————————————————————————————————————————

export type HomePrayerPreview = {
  id: string;
  memberName: string;
  content: string;
  createdAt: string;
};

/** Exclude confidential / non-published rows. Mirrors PrayerWall + RLS intent. */
export function isPublicPrayerRow(row: unknown): boolean {
  const r = asRecord(row);
  if (r.is_confidential === true) return false;
  const status = String(r.status || '').trim().toLowerCase();
  if (status === 'confidential' || status === 'vetting' || status === 'archived') {
    return false;
  }
  // If status column is present and non-empty, require Published
  if (status && status !== 'published') return false;
  return true;
}

export function normalizePrayerRow(row: unknown): HomePrayerPreview {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ''),
    memberName: String(r.member_name || r.name || 'Member'),
    content: String(r.content || r.request || ''),
    createdAt: String(r.created_at || ''),
  };
}

/**
 * PrayerWall / Home read contract on sessionless anon client:
 * select('*') + status = Published (matches Vault WALL + RLS), newest first.
 * Client filter drops confidential rows; null is_confidential stays public.
 */
export async function fetchMemberHomePrayers(opts?: {
  limit?: number;
}): Promise<HomePrayerPreview[]> {
  const limit = opts?.limit ?? 2;

  const result = await supabasePublic
    .from('prayer_requests')
    .select('*')
    .eq('status', 'Published')
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 3, 6));

  if (result.error) {
    console.error('[member-home prayer]', result.error.code, result.error.message);
    throw result.error;
  }

  return (result.data || [])
    .filter(isPublicPrayerRow)
    .map(normalizePrayerRow)
    .filter((p) => p.id && p.content)
    .slice(0, limit);
}

// —— Latest sermon / message ————————————————————————————————————————

export type HomeSermonPreview = {
  /** sermons.id when source is sermons; otherwise null */
  id: string | null;
  title: string;
  speaker: string | null;
  date: string | null;
  scripture: string | null;
  imageUrl: string | null;
  watchUrl: string | null;
  /** YouTube video id when source is youtube and known */
  youtubeVideoId: string | null;
  source: 'sermons' | 'youtube';
};

const PLACEHOLDER_TITLE_RE =
  /^(your sermon title here|sermon title|untitled|test sermon|sample sermon)$/i;
const PLACEHOLDER_SPEAKER_RE = /^(pastor name|speaker name|test pastor)$/i;

export function isPlaceholderSermon(row: {
  title?: string | null;
  speaker?: string | null;
}): boolean {
  const title = String(row.title || '').trim();
  const speaker = String(row.speaker || '').trim();
  if (!title) return true;
  if (PLACEHOLDER_TITLE_RE.test(title)) return true;
  if (speaker && PLACEHOLDER_SPEAKER_RE.test(speaker)) return true;
  return false;
}

function mapSermonRow(row: Record<string, unknown>): HomeSermonPreview {
  const imageUrl = row.image_url || row.thumbnail_url || row.imageUrl
    ? String(row.image_url || row.thumbnail_url || row.imageUrl)
    : null;
  const id = row.id ? String(row.id) : null;
  return {
    id: id && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
    title: String(row.title || 'Latest message'),
    speaker: row.speaker ? String(row.speaker) : null,
    date: row.date ? String(row.date) : null,
    scripture: row.scripture ? String(row.scripture) : null,
    imageUrl,
    watchUrl: null,
    youtubeVideoId: null,
    source: 'sermons',
  };
}

type LatestYoutubePayload = {
  url?: string;
  videoId?: string;
  title?: string;
  published?: string;
};

async function fetchLatestYoutubeMessage(): Promise<HomeSermonPreview | null> {
  try {
    const res = await fetch('/api/latest-youtube', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as LatestYoutubePayload;
      const url = body.url || (body.videoId ? `https://www.youtube.com/watch?v=${body.videoId}` : '');
      const title = String(body.title || '').trim();
      if (url && title && !PLACEHOLDER_TITLE_RE.test(title)) {
        return {
          id: null,
          title,
          speaker: null,
          date: body.published ? String(body.published).slice(0, 10) : null,
          scripture: null,
          imageUrl: getYouTubeThumbnailUrl(url) || null,
          watchUrl: url,
          youtubeVideoId: body.videoId || getYouTubeVideoId(url),
          source: 'youtube',
        };
      }
      if (url) {
        // Title missing — still usable with generic label + real watch target
        return {
          id: null,
          title: 'Latest Message',
          speaker: null,
          date: body.published ? String(body.published).slice(0, 10) : null,
          scripture: null,
          imageUrl: getYouTubeThumbnailUrl(url) || null,
          watchUrl: url,
          youtubeVideoId: body.videoId || getYouTubeVideoId(url),
          source: 'youtube',
        };
      }
    }
  } catch {
    /* fall through */
  }

  const url = await resolveLatestVideoUrl().catch(() => '');
  if (!url || url.includes('/channel/')) return null;
  return {
    id: null,
    title: 'Latest Message',
    speaker: null,
    date: null,
    scripture: null,
    imageUrl: getYouTubeThumbnailUrl(url) || null,
    watchUrl: url,
    youtubeVideoId: getYouTubeVideoId(url),
    source: 'youtube',
  };
}

/**
 * Prefer a real sermons-table row; skip seed/demo placeholders.
 * Otherwise reuse the same Watch / YouTube latest-message source.
 */
export async function fetchMemberHomeLatestSermon(): Promise<HomeSermonPreview | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabasePublic
    .from('sermons')
    .select('*')
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(8);

  if (error) {
    console.error('[member-home sermon]', error.code, error.message);
  }

  if (!error && data?.length) {
    for (const row of data) {
      const rec = asRecord(row);
      if (isPlaceholderSermon({ title: String(rec.title || ''), speaker: String(rec.speaker || '') })) {
        continue;
      }
      return mapSermonRow(rec);
    }
  }

  return fetchLatestYoutubeMessage();
}
