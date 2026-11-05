/**
 * Phase 2.5 — private sermon notes via authenticated Supabase client + self-only RLS.
 * Anon key only in the browser — never elevated server credentials.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { NoteEntryType, SermonNote, SermonNoteStartContext, SermonNoteSourceType } from './sermonNotesTypes';
import { NOTE_ANSWER_MAX, SERMON_NOTE_CONTENT_MAX, SERMON_NOTE_TITLE_MAX } from './sermonNotesTypes';
import { clampNoteContent, clampNoteTitle, isUuid, mapSermonNoteError, parseEntryType } from './sermonNotesUi';

const LEGACY_COLUMNS =
  'id, user_id, sermon_id, source_type, source_ref, title, content, sermon_title, speaker_name, sermon_date, created_at, updated_at';
const JOURNAL_COLUMNS = `${LEGACY_COLUMNS}, entry_type, answered_at, answer_note`;

/**
 * Until the journal columns (entry_type, answered_at, answer_note) are added in Supabase,
 * notes keep working as plain sermon notes. Set once we see "column does not exist".
 */
let journalColumnsMissing = false;

function isMissingJournalColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    (String(error.code || '') === '42703' || String(error.code || '') === 'PGRST204') &&
    /entry_type|answered_at|answer_note/i.test(msg)
  );
}

/** True once we know the journal columns aren't in the database yet. */
export function journalFeaturesUnavailable(): boolean {
  return journalColumnsMissing;
}

export class SermonNotesClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || mapSermonNoteError(code));
    this.name = 'SermonNotesClientError';
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function parseSourceType(value: unknown): SermonNoteSourceType {
  const s = String(value || '').toLowerCase();
  if (s === 'sermon' || s === 'youtube' || s === 'manual') return s;
  return 'manual';
}

function mapRow(row: unknown): SermonNote | null {
  const r = asRecord(row);
  const id = asNullableString(r.id);
  const userId = asNullableString(r.user_id);
  if (!id || !isUuid(id) || !userId || !isUuid(userId)) return null;
  return {
    id,
    userId,
    sermonId: isUuid(r.sermon_id) ? String(r.sermon_id) : null,
    sourceType: parseSourceType(r.source_type),
    sourceRef: asNullableString(r.source_ref),
    title: asNullableString(r.title),
    content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
    sermonTitle: asNullableString(r.sermon_title),
    speakerName: asNullableString(r.speaker_name),
    sermonDate: r.sermon_date ? String(r.sermon_date).slice(0, 10) : null,
    entryType: parseEntryType(r.entry_type),
    answeredAt: r.answered_at ? String(r.answered_at).slice(0, 10) : null,
    answerNote: asNullableString(r.answer_note),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

async function requireAuthUserId(): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new SermonNotesClientError('not_configured');
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new SermonNotesClientError('not_authenticated');
  }
  return data.session.user.id;
}

function mapPostgrestError(error: { code?: string; message?: string } | null): never {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  // Undefined table / schema cache
  if (code === '42P01' || code === 'PGRST205' || /sermon_notes/i.test(message)) {
    throw new SermonNotesClientError('schema_missing');
  }
  if (code === '42501' || /permission denied|rls/i.test(message)) {
    throw new SermonNotesClientError('forbidden');
  }
  if (code === '23503') {
    throw new SermonNotesClientError('validation', 'That sermon link is no longer available.');
  }
  if (code === '23514') {
    throw new SermonNotesClientError('validation');
  }
  throw new SermonNotesClientError('unavailable', mapSermonNoteError('unavailable'));
}

async function selectNotes(build: (columns: string) => PromiseLike<{ data: unknown; error: any }>) {
  if (!journalColumnsMissing) {
    const res = await build(JOURNAL_COLUMNS);
    if (!isMissingJournalColumn(res.error)) return res;
    journalColumnsMissing = true;
  }
  return build(LEGACY_COLUMNS);
}

export async function listMySermonNotes(): Promise<SermonNote[]> {
  await requireAuthUserId();
  const { data, error } = await selectNotes((columns) =>
    supabase.from('sermon_notes').select(columns).order('updated_at', { ascending: false })
  );

  if (error) mapPostgrestError(error);
  return ((data as unknown[]) || []).map(mapRow).filter((n): n is SermonNote => Boolean(n));
}

export async function getMySermonNote(id: string): Promise<SermonNote> {
  if (!isUuid(id)) throw new SermonNotesClientError('not_found');
  await requireAuthUserId();
  const { data, error } = await selectNotes((columns) =>
    supabase.from('sermon_notes').select(columns).eq('id', id.trim()).maybeSingle()
  );

  if (error) mapPostgrestError(error);
  const note = mapRow(data);
  if (!note) throw new SermonNotesClientError('not_found');
  return note;
}

export type SaveSermonNoteInput = {
  title: string | null;
  content: string;
  sourceType?: SermonNoteSourceType;
  sermonId?: string | null;
  sourceRef?: string | null;
  sermonTitle?: string | null;
  speakerName?: string | null;
  sermonDate?: string | null;
  entryType?: NoteEntryType;
};

export type SaveNoteJournalFields = {
  entryType?: NoteEntryType;
  /** YYYY-MM-DD, or null to clear. Prayer entries only. */
  answeredAt?: string | null;
  answerNote?: string | null;
};

/** Journal fields for a row; answered fields are cleared on anything but a prayer. */
function journalRow(fields: SaveNoteJournalFields, fallbackType: NoteEntryType): Record<string, unknown> {
  const entryType = parseEntryType(fields.entryType || fallbackType);
  const isPrayer = entryType === 'prayer';
  const answeredAt =
    isPrayer && fields.answeredAt && /^\d{4}-\d{2}-\d{2}$/.test(fields.answeredAt) ? fields.answeredAt : null;
  const answerNote = isPrayer && answeredAt ? String(fields.answerNote || '').trim().slice(0, NOTE_ANSWER_MAX) || null : null;
  return { entry_type: entryType, answered_at: answeredAt, answer_note: answerNote };
}

/** Insert/update, retrying without journal columns if the database doesn't have them yet. */
async function writeNote(
  run: (row: Record<string, unknown>) => PromiseLike<{ data: unknown; error: any }>,
  base: Record<string, unknown>,
  journal: Record<string, unknown>
) {
  if (!journalColumnsMissing) {
    const res = await run({ ...base, ...journal });
    if (!isMissingJournalColumn(res.error)) return res;
    journalColumnsMissing = true;
  }
  // Older database: only a plain sermon note can be saved.
  const wantsJournal = journal.entry_type !== 'sermon' || journal.answered_at != null;
  if (wantsJournal) throw new SermonNotesClientError('journal_unavailable');
  return run(base);
}

export async function createMySermonNote(
  input: SaveSermonNoteInput,
  start?: SermonNoteStartContext | null
): Promise<SermonNote> {
  const userId = await requireAuthUserId();
  const sourceType = start?.sourceType || input.sourceType || 'manual';
  const sermonId =
    sourceType === 'sermon' && isUuid(start?.sermonId || input.sermonId)
      ? String(start?.sermonId || input.sermonId).trim()
      : null;
  const sourceRef =
    sourceType === 'youtube'
      ? String(start?.sourceRef || input.sourceRef || '')
          .trim()
          .slice(0, 500) || null
      : null;

  const row = {
    user_id: userId,
    sermon_id: sermonId,
    source_type: sourceType,
    source_ref: sourceRef,
    title: clampNoteTitle(input.title || start?.title || '') || null,
    content: clampNoteContent(input.content || ''),
    sermon_title: (start?.sermonTitle || input.sermonTitle || null)?.slice(0, 300) || null,
    speaker_name: (start?.speakerName || input.speakerName || null)?.slice(0, 200) || null,
    sermon_date: (start?.sermonDate || input.sermonDate || null)?.slice(0, 10) || null,
  };

  if ((row.title && row.title.length > SERMON_NOTE_TITLE_MAX) || row.content.length > SERMON_NOTE_CONTENT_MAX) {
    throw new SermonNotesClientError('validation');
  }

  const defaultType: NoteEntryType = start?.entryType || input.entryType || 'sermon';
  const { data, error } = await writeNote(
    (r) => supabase.from('sermon_notes').insert(r).select('*').maybeSingle(),
    row,
    journalRow({ entryType: input.entryType }, defaultType)
  );
  if (error) mapPostgrestError(error);
  const note = mapRow(data);
  if (!note) throw new SermonNotesClientError('unavailable');
  return note;
}

export async function updateMySermonNote(
  id: string,
  input: Pick<SaveSermonNoteInput, 'title' | 'content'> & SaveNoteJournalFields
): Promise<SermonNote> {
  if (!isUuid(id)) throw new SermonNotesClientError('not_found');
  await requireAuthUserId();

  const { data, error } = await writeNote(
    (r) => supabase.from('sermon_notes').update(r).eq('id', id.trim()).select('*').maybeSingle(),
    {
      title: clampNoteTitle(input.title || '') || null,
      content: clampNoteContent(input.content || ''),
    },
    journalRow(input, 'sermon')
  );

  if (error) mapPostgrestError(error);
  const note = mapRow(data);
  if (!note) throw new SermonNotesClientError('not_found');
  return note;
}

export async function deleteMySermonNote(id: string): Promise<void> {
  if (!isUuid(id)) throw new SermonNotesClientError('not_found');
  await requireAuthUserId();
  const { error, count } = await supabase
    .from('sermon_notes')
    .delete({ count: 'exact' })
    .eq('id', id.trim());

  if (error) mapPostgrestError(error);
  if (count === 0) throw new SermonNotesClientError('not_found');
}
