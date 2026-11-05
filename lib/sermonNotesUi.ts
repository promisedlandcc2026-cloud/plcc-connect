/**
 * Phase 2.5 — sermon notes UI helpers (pure, no I/O).
 */

import type { HomeSermonPreview } from './memberHomeData';
import { getYouTubeVideoId } from './youtube';
import type { NoteEntryType, SermonNote, SermonNoteStartContext, SermonNoteSourceType } from './sermonNotesTypes';
import { NOTE_ENTRY_TYPES, SERMON_NOTE_CONTENT_MAX, SERMON_NOTE_TITLE_MAX } from './sermonNotesTypes';

export function parseEntryType(value: unknown): NoteEntryType {
  const s = String(value || '').toLowerCase();
  return (NOTE_ENTRY_TYPES as string[]).includes(s) ? (s as NoteEntryType) : 'sermon';
}

export const NOTE_ENTRY_TYPE_LABEL: Record<NoteEntryType, string> = {
  sermon: 'Sermon note',
  prayer: 'Prayer',
  reflection: 'Reflection',
  gratitude: 'Gratitude',
};

/** Optional starters — tapping one adds the question to the entry. Never required. */
export const NOTE_ENTRY_PROMPTS: Record<NoteEntryType, string[]> = {
  sermon: ['What stood out to me today?', 'Scripture to remember:', 'One thing I will do this week:'],
  prayer: ['Lord, I am praying for…', 'I am trusting You with…', 'Please help me with…'],
  reflection: ['What is God teaching me right now?', 'A verse that spoke to me:', 'Where did I see God this week?'],
  gratitude: ['Today I am thankful for…', 'A blessing I almost missed:', 'Someone I am grateful for:'],
};

/** Add a prompt to the end of an entry, on its own line. */
export function appendPrompt(content: string, prompt: string): string {
  const body = String(content || '').replace(/\s+$/, '');
  return clampNoteContent(body ? `${body}\n\n${prompt} ` : `${prompt} `);
}

export type NotesFilter = 'all' | NoteEntryType | 'answered';

export const NOTES_FILTERS: { key: NotesFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sermon', label: 'Sermon notes' },
  { key: 'prayer', label: 'Prayers' },
  { key: 'answered', label: 'Answered' },
  { key: 'reflection', label: 'Reflections' },
  { key: 'gratitude', label: 'Gratitude' },
];

/** Filter by kind. "Answered" lists answered prayers, newest answer first. */
export function filterNotesByType(notes: SermonNote[], filter: NotesFilter): SermonNote[] {
  if (filter === 'all') return notes;
  if (filter === 'answered') {
    return notes
      .filter((n) => n.entryType === 'prayer' && n.answeredAt)
      .sort((a, b) => String(b.answeredAt).localeCompare(String(a.answeredAt)));
  }
  return notes.filter((n) => n.entryType === filter);
}

export function countAnsweredPrayers(notes: Pick<SermonNote, 'entryType' | 'answeredAt'>[]): number {
  return notes.filter((n) => n.entryType === 'prayer' && n.answeredAt).length;
}

/** Today in the member's own time zone, as YYYY-MM-DD. */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function truncateNotePreview(text: string, max = 120): string {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function noteDisplayTitle(
  note: Pick<SermonNote, 'title' | 'sermonTitle'> & Partial<Pick<SermonNote, 'entryType'>>
): string {
  const title = String(note.title || '').trim();
  if (title) return title;
  const sermon = String(note.sermonTitle || '').trim();
  if (sermon) return sermon;
  if (note.entryType && note.entryType !== 'sermon') return `Untitled ${NOTE_ENTRY_TYPE_LABEL[note.entryType].toLowerCase()}`;
  return 'Untitled note';
}

export function formatNoteUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatNoteSermonDate(date: string | null | undefined): string {
  if (!date) return '';
  const raw = String(date).slice(0, 10);
  const ms = Date.parse(`${raw}T12:00:00`);
  if (!Number.isFinite(ms)) return raw;
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function clampNoteTitle(value: string): string {
  return String(value || '').slice(0, SERMON_NOTE_TITLE_MAX);
}

export function clampNoteContent(value: string): string {
  return String(value || '').slice(0, SERMON_NOTE_CONTENT_MAX);
}

/**
 * Build start context from a real Home sermon/message preview.
 * Does not invent title/speaker/date when missing.
 */
export function startContextFromSermonPreview(
  sermon: HomeSermonPreview | null | undefined
): SermonNoteStartContext {
  if (!sermon) {
    return { sourceType: 'manual' };
  }

  if (sermon.source === 'sermons' && isUuid(sermon.id)) {
    return {
      sourceType: 'sermon',
      sermonId: sermon.id!.trim(),
      sermonTitle: sermon.title?.trim() || null,
      speakerName: sermon.speaker?.trim() || null,
      sermonDate: sermon.date ? String(sermon.date).slice(0, 10) : null,
      title: sermon.title?.trim() ? `Notes — ${sermon.title.trim()}` : null,
    };
  }

  if (sermon.source === 'youtube') {
    const videoId =
      sermon.youtubeVideoId?.trim() ||
      (sermon.watchUrl ? getYouTubeVideoId(sermon.watchUrl) : null);
    if (videoId) {
      const knownTitle =
        sermon.title && sermon.title !== 'Latest Message' ? sermon.title.trim() : null;
      return {
        sourceType: 'youtube',
        sourceRef: videoId,
        sermonTitle: knownTitle,
        speakerName: sermon.speaker?.trim() || null,
        sermonDate: sermon.date ? String(sermon.date).slice(0, 10) : null,
        title: knownTitle ? `Notes — ${knownTitle}` : 'Notes — Latest Message',
      };
    }
  }

  return { sourceType: 'manual' };
}

export function notesNewPath(ctx?: SermonNoteStartContext | null): string {
  if (!ctx || ctx.sourceType === 'manual') {
    return ctx?.entryType && ctx.entryType !== 'sermon' ? `/notes/new?type=${ctx.entryType}` : '/notes/new';
  }
  const params = new URLSearchParams();
  params.set('source', ctx.sourceType);
  if (ctx.sermonId && isUuid(ctx.sermonId)) params.set('sermonId', ctx.sermonId.trim());
  if (ctx.sourceRef) params.set('ref', String(ctx.sourceRef).slice(0, 500));
  if (ctx.title) params.set('title', clampNoteTitle(ctx.title));
  if (ctx.sermonTitle) params.set('sermonTitle', String(ctx.sermonTitle).slice(0, 300));
  if (ctx.speakerName) params.set('speaker', String(ctx.speakerName).slice(0, 200));
  if (ctx.sermonDate) params.set('date', String(ctx.sermonDate).slice(0, 10));
  const q = params.toString();
  return q ? `/notes/new?${q}` : '/notes/new';
}

export function parseNotesNewSearch(search: string): SermonNoteStartContext {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawSource = String(params.get('source') || 'manual').toLowerCase();
  const sourceType: SermonNoteSourceType =
    rawSource === 'sermon' || rawSource === 'youtube' || rawSource === 'manual'
      ? rawSource
      : 'manual';

  const sermonId = params.get('sermonId');
  const sourceRef = params.get('ref');
  const title = params.get('title');
  const sermonTitle = params.get('sermonTitle');
  const speakerName = params.get('speaker');
  const sermonDate = params.get('date');

  if (sourceType === 'sermon' && isUuid(sermonId)) {
    return {
      sourceType: 'sermon',
      sermonId: sermonId!.trim(),
      sourceRef: null,
      title: title ? clampNoteTitle(title) : null,
      sermonTitle: sermonTitle ? String(sermonTitle).slice(0, 300) : null,
      speakerName: speakerName ? String(speakerName).slice(0, 200) : null,
      sermonDate: sermonDate ? String(sermonDate).slice(0, 10) : null,
    };
  }

  if (sourceType === 'youtube' && sourceRef) {
    return {
      sourceType: 'youtube',
      sermonId: null,
      sourceRef: String(sourceRef).slice(0, 500),
      title: title ? clampNoteTitle(title) : null,
      sermonTitle: sermonTitle ? String(sermonTitle).slice(0, 300) : null,
      speakerName: speakerName ? String(speakerName).slice(0, 200) : null,
      sermonDate: sermonDate ? String(sermonDate).slice(0, 10) : null,
    };
  }

  const rawType = params.get('type');
  return {
    sourceType: 'manual',
    title: title ? clampNoteTitle(title) : null,
    entryType: rawType ? parseEntryType(rawType) : null,
  };
}

export function filterNotesClientSide(notes: SermonNote[], query: string): SermonNote[] {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => {
    const hay = [n.title, n.sermonTitle, n.speakerName, n.content, n.answerNote]
      .map((s) => String(s || '').toLowerCase())
      .join('\n');
    return hay.includes(q);
  });
}

export function mapSermonNoteError(code: string | null | undefined): string {
  switch (String(code || '')) {
    case 'not_authenticated':
      return 'Sign in to use sermon notes.';
    case 'not_configured':
      return 'Sermon notes are not configured right now.';
    case 'not_found':
      return 'That note could not be found.';
    case 'forbidden':
      return 'You can only access your own sermon notes.';
    case 'schema_missing':
      return 'Sermon notes are not available yet. Please try again later.';
    case 'validation':
      return 'Please check your note and try again.';
    case 'journal_unavailable':
      return 'Prayers, reflections and gratitude are almost ready. For now, save this as a sermon note.';
    default:
      return 'Could not update sermon notes right now.';
  }
}
