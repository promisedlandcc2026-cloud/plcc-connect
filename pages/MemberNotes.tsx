import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buttonClass } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { Check, HandHeart, Plus, Search } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { StudyGuidesSection } from '../components/notes/StudyGuidesSection';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { listMySermonNotes, SermonNotesClientError } from '../lib/sermonNotesClient';
import type { SermonNote } from '../lib/sermonNotesTypes';
import {
  countAnsweredPrayers,
  filterNotesByType,
  filterNotesClientSide,
  formatNoteSermonDate,
  formatNoteUpdatedAt,
  mapSermonNoteError,
  NOTE_ENTRY_TYPE_LABEL,
  NOTES_FILTERS,
  noteDisplayTitle,
  notesNewPath,
  type NotesFilter,
  truncateNotePreview,
} from '../lib/sermonNotesUi';

/**
 * My Notes & Journal — sermon notes, prayers (with answered prayers), reflections and
 * gratitude. Private index for the signed-in approved member only.
 */
export const MemberNotesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<SermonNote[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<NotesFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotes(await listMySermonNotes());
    } catch (err) {
      const code = err instanceof SermonNotesClientError ? err.code : 'unavailable';
      setError(mapSermonNoteError(code));
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterNotesClientSide(filterNotesByType(notes, filter), query),
    [notes, filter, query]
  );
  const answeredCount = useMemo(() => countAnsweredPrayers(notes), [notes]);
  const hasJournalEntries = useMemo(() => notes.some((n) => n.entryType !== 'sermon'), [notes]);

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="My Notes & Journal"
        eyebrow="Messages, prayers & reflections"
        subtitle="Study guides from PLCC for each message. Your own notes and journal are private to your account."
        backTo="/me"
        backLabel="Me"
      />

      <StudyGuidesSection />

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] font-bold text-ink">My notes & journal</h2>
        <span className="text-xs font-semibold text-ink-soft">Private to you</span>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <Link
          to="/notes/new"
          className={buttonClass({ fullWidth: true })}
        >
          <Plus size={18} aria-hidden />
          New note
        </Link>
        <Link
          to={notesNewPath({ sourceType: 'manual', entryType: 'prayer' })}
          className={buttonClass({ fullWidth: true, variant: 'secondary' })}
        >
          <HandHeart size={18} aria-hidden />
          Write a prayer
        </Link>
        {answeredCount > 0 ? (
          <button
            type="button"
            onClick={() => setFilter('answered')}
            className="flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-[15px] font-bold text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            <Check size={18} aria-hidden />
            {answeredCount === 1 ? '1 answered prayer' : `${answeredCount} answered prayers`} — see them
          </button>
        ) : null}
        {!loading && hasJournalEntries ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {NOTES_FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.key)}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy ${
                    active ? 'border-burgundy bg-burgundy text-white' : 'border-gray-200 bg-white text-[#1A1A1A]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {!loading && notes.length > 0 ? (
          <label className="block">
            <span className="sr-only">Search your notes</span>
            <span className="relative flex items-center">
              <Search
                size={16}
                className="absolute left-3 text-gray-500 pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes"
                className="w-full min-h-[44px] rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </span>
          </label>
        ) : null}
      </div>

      {loading ? <LoadingState message="Loading your notes…" /> : null}
      {!loading && error ? (
        <div role="alert">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : null}
      {!loading && !error && notes.length === 0 ? (
        <EmptyState
          message="You haven’t written anything yet."
          hint="Take notes from Sunday Mode, start a blank note, or write a prayer."
        />
      ) : null}
      {!loading && !error && notes.length > 0 && filtered.length === 0 ? (
        <EmptyState
          message={
            query.trim()
              ? 'Nothing matches your search.'
              : filter === 'answered'
                ? 'No answered prayers yet. Open a prayer and tap “Mark this prayer answered” when God answers.'
                : 'Nothing here yet.'
          }
        />
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <ul className="space-y-3" aria-label="Your notes and journal">
          {filtered.map((note) => {
            const preview = truncateNotePreview(note.content);
            const kind =
              note.entryType === 'prayer' && note.answeredAt
                ? `Answered prayer · ${formatNoteSermonDate(note.answeredAt)}`
                : NOTE_ENTRY_TYPE_LABEL[note.entryType];
            const meta = [
              note.sermonTitle,
              note.speakerName,
              formatNoteSermonDate(note.sermonDate),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={note.id}>
                <Link
                  to={`/notes/${note.id}`}
                  className="block rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                >
                  <p
                    className={`text-[11px] font-black uppercase tracking-widest ${
                      note.answeredAt ? 'text-emerald-700' : 'text-burgundy'
                    }`}
                  >
                    {kind}
                  </p>
                  <p className="text-base font-bold text-[#1A1A1A] leading-snug break-words">
                    {noteDisplayTitle(note)}
                  </p>
                  {meta ? (
                    <p className="text-xs text-gray-500 leading-snug break-words">{meta}</p>
                  ) : null}
                  <p className="text-xs text-gray-500">
                    Updated {formatNoteUpdatedAt(note.updatedAt)}
                  </p>
                  {preview ? (
                    <p className="text-[13px] text-gray-600 leading-relaxed break-words">{preview}</p>
                  ) : (
                    <p className="text-[13px] text-gray-500 italic">No content yet</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
};
