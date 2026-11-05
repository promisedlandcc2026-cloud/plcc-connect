import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, HandHeart, Lightbulb, Sparkles } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingState } from '../components/ui/States';
import {
  createMySermonNote,
  deleteMySermonNote,
  getMySermonNote,
  journalFeaturesUnavailable,
  SermonNotesClientError,
  updateMySermonNote,
} from '../lib/sermonNotesClient';
import type { NoteEntryType, SermonNoteStartContext } from '../lib/sermonNotesTypes';
import { NOTE_ANSWER_MAX, NOTE_ENTRY_TYPES, SERMON_NOTE_CONTENT_MAX, SERMON_NOTE_TITLE_MAX } from '../lib/sermonNotesTypes';
import {
  appendPrompt,
  clampNoteContent,
  clampNoteTitle,
  formatNoteSermonDate,
  mapSermonNoteError,
  NOTE_ENTRY_PROMPTS,
  NOTE_ENTRY_TYPE_LABEL,
  parseNotesNewSearch,
  todayIsoDate,
} from '../lib/sermonNotesUi';

const ENTRY_TYPE_ICON: Record<NoteEntryType, React.ReactNode> = {
  sermon: <BookOpen size={18} aria-hidden />,
  prayer: <HandHeart size={18} aria-hidden />,
  reflection: <Lightbulb size={18} aria-hidden />,
  gratitude: <Sparkles size={18} aria-hidden />,
};

const CONTENT_PLACEHOLDER: Record<NoteEntryType, string> = {
  sermon: 'Write your sermon notes…',
  prayer: 'Write your prayer…',
  reflection: 'Write what is on your heart…',
  gratitude: 'Write what you are thankful for…',
};

type EditorMode = 'new' | 'edit';

/**
 * Create / edit a private sermon note. Explicit Save; confirm before delete.
 */
export const MemberNoteEditorPage: React.FC<{ mode: EditorMode }> = ({ mode }) => {
  // Members keep this open through the service — don't let the phone sleep.
  useScreenWakeLock(true);
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const startContext = useMemo<SermonNoteStartContext>(
    () => (mode === 'new' ? parseNotesNewSearch(searchParams.toString()) : { sourceType: 'manual' }),
    [mode, searchParams]
  );

  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(() =>
    mode === 'new' ? clampNoteTitle(startContext.title || '') : ''
  );
  // "Add to notes" from the Bible passes the verse as ?text= — start the note with it.
  const [content, setContent] = useState(() =>
    mode === 'new' ? clampNoteContent(searchParams.get('text') ? `${searchParams.get('text')}\n\n` : '') : ''
  );
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(() => mode === 'new' && Boolean(searchParams.get('text')));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(mode === 'edit' ? routeId || null : null);
  const [entryType, setEntryType] = useState<NoteEntryType>(() =>
    mode === 'new' ? startContext.entryType || 'sermon' : 'sermon'
  );
  const [answeredAt, setAnsweredAt] = useState<string | null>(null);
  const [answerNote, setAnswerNote] = useState('');
  const journalReady = !journalFeaturesUnavailable();
  const typeLabel = NOTE_ENTRY_TYPE_LABEL[entryType];

  const buildContextLabel = useCallback((ctx: {
    sermonTitle?: string | null;
    speakerName?: string | null;
    sermonDate?: string | null;
    sourceType?: string;
  }) => {
    const parts = [
      ctx.sermonTitle,
      ctx.speakerName,
      formatNoteSermonDate(ctx.sermonDate || null),
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    if (ctx.sourceType === 'youtube') return 'Linked to a YouTube message';
    if (ctx.sourceType === 'sermon') return 'Linked to a church message';
    return null;
  }, []);

  useEffect(() => {
    if (mode !== 'new') return;
    setContextLabel(buildContextLabel(startContext));
  }, [mode, startContext, buildContextLabel]);

  useEffect(() => {
    if (mode !== 'edit' || !routeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const note = await getMySermonNote(routeId);
        if (cancelled) return;
        setNoteId(note.id);
        setTitle(note.title || '');
        setContent(note.content || '');
        setEntryType(note.entryType);
        setAnsweredAt(note.answeredAt);
        setAnswerNote(note.answerNote || '');
        setContextLabel(
          buildContextLabel({
            sermonTitle: note.sermonTitle,
            speakerName: note.speakerName,
            sermonDate: note.sermonDate,
            sourceType: note.sourceType,
          })
        );
        setDirty(false);
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof SermonNotesClientError ? err.code : 'unavailable';
        setLoadError(mapSermonNoteError(code));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, routeId, buildContextLabel]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const onTitleChange = (value: string) => {
    setTitle(clampNoteTitle(value));
    setDirty(true);
    setSavedFlash(false);
    setSaveError(null);
  };

  const onContentChange = (value: string) => {
    setContent(clampNoteContent(value));
    setDirty(true);
    setSavedFlash(false);
    setSaveError(null);
  };

  const markChanged = () => {
    setDirty(true);
    setSavedFlash(false);
    setSaveError(null);
  };

  const onEntryTypeChange = (next: NoteEntryType) => {
    if (next === entryType) return;
    setEntryType(next);
    if (next !== 'prayer') {
      setAnsweredAt(null);
      setAnswerNote('');
    }
    markChanged();
  };

  const onAddPrompt = (prompt: string) => {
    setContent((c) => appendPrompt(c, prompt));
    markChanged();
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const journal = {
      entryType,
      answeredAt: entryType === 'prayer' ? answeredAt : null,
      answerNote: entryType === 'prayer' && answeredAt ? answerNote : null,
    };
    try {
      if (noteId) {
        const updated = await updateMySermonNote(noteId, { title, content, ...journal });
        setTitle(updated.title || '');
        setContent(updated.content);
        setEntryType(updated.entryType);
        setAnsweredAt(updated.answeredAt);
        setAnswerNote(updated.answerNote || '');
        setDirty(false);
        setSavedFlash(true);
      } else {
        const created = await createMySermonNote({ title, content, entryType }, startContext);
        // A new prayer can be marked answered before its first save.
        const saved =
          journal.answeredAt && created.entryType === 'prayer'
            ? await updateMySermonNote(created.id, { title: created.title, content: created.content, ...journal })
            : created;
        setNoteId(saved.id);
        setEntryType(saved.entryType);
        setAnsweredAt(saved.answeredAt);
        setAnswerNote(saved.answerNote || '');
        setTitle(saved.title || '');
        setContent(saved.content);
        setDirty(false);
        setSavedFlash(true);
        navigate(`/notes/${saved.id}`, { replace: true });
      }
    } catch (err) {
      // Keep editor content on failure — do not clear what the member typed.
      const code = err instanceof SermonNotesClientError ? err.code : 'unavailable';
      setSaveError(err instanceof SermonNotesClientError ? err.message : mapSermonNoteError(code));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!noteId) {
      navigate('/notes');
      return;
    }
    const ok = window.confirm(`Delete this ${typeLabel.toLowerCase()}? This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMySermonNote(noteId);
      setDirty(false);
      navigate('/notes', { replace: true });
    } catch (err) {
      const code = err instanceof SermonNotesClientError ? err.code : 'unavailable';
      setDeleteError(mapSermonNoteError(code));
    } finally {
      setDeleting(false);
    }
  };

  const handleBackClick = (e: React.MouseEvent) => {
    if (!dirty) return;
    const ok = window.confirm('You have unsaved changes. Leave without saving?');
    if (!ok) e.preventDefault();
  };

  if (loading) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader title="Sermon note" backTo="/notes" backLabel="Notes" />
        <LoadingState message="Loading note…" />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader title="Sermon note" backTo="/notes" backLabel="Notes" />
        <div role="alert">
          <ErrorState message={loadError} onRetry={() => window.location.reload()} />
        </div>
        <Link
          to="/notes"
          className="inline-flex items-center min-h-[44px] text-sm font-bold text-burgundy mt-4"
        >
          Back to notes
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <div onClickCapture={handleBackClick}>
        <MemberPageHeader
          title={mode === 'new' && !noteId ? `New ${typeLabel.toLowerCase()}` : `Edit ${typeLabel.toLowerCase()}`}
          eyebrow="Private"
          subtitle="Your notes and journal are private to your account."
          backTo="/notes"
          backLabel="Notes"
        />
      </div>

      {contextLabel ? (
        <p className="mb-4 text-xs text-gray-500 leading-relaxed break-words">{contextLabel}</p>
      ) : null}

      <div className="space-y-4">
        {journalReady ? (
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
              What is this?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_ENTRY_TYPES.map((t) => {
                const active = t === entryType;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onEntryTypeChange(t)}
                    className={`flex items-center justify-center gap-2 min-h-[52px] rounded-2xl border px-3 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy ${
                      active
                        ? 'border-burgundy bg-burgundy text-white'
                        : 'border-gray-200 bg-white text-[#1A1A1A]'
                    }`}
                  >
                    {ENTRY_TYPE_ICON[t]}
                    {NOTE_ENTRY_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-gray-500">
            Title
          </span>
          <input
            type="text"
            value={title}
            maxLength={SERMON_NOTE_TITLE_MAX}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={`${typeLabel} title`}
            className="w-full min-h-[48px] rounded-2xl border border-gray-200 bg-white px-4 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          />
        </label>

        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">Need a starting point? Tap one (optional):</p>
          <div className="flex flex-wrap gap-2">
            {NOTE_ENTRY_PROMPTS[entryType].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onAddPrompt(prompt)}
                className="min-h-[40px] rounded-full border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-gray-500">
            {entryType === 'sermon' ? 'Notes' : typeLabel}
          </span>
          <textarea
            value={content}
            maxLength={SERMON_NOTE_CONTENT_MAX}
            onChange={(e) => onContentChange(e.target.value)}
            rows={14}
            placeholder={CONTENT_PLACEHOLDER[entryType]}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1A1A1A] leading-relaxed placeholder:text-gray-400 resize-y min-h-[220px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          />
          <span className="block text-xs text-gray-500 text-right">
            {content.length.toLocaleString()} / {SERMON_NOTE_CONTENT_MAX.toLocaleString()}
          </span>
        </label>

        {journalReady && entryType === 'prayer' ? (
          answeredAt ? (
            <section
              aria-label="Answered prayer"
              className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"
            >
              <p className="flex items-center gap-2 text-base font-bold text-emerald-800">
                <Check size={18} aria-hidden />
                Answered — praise God!
              </p>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-900/70">
                  Date answered
                </span>
                <input
                  type="date"
                  value={answeredAt}
                  max={todayIsoDate()}
                  onChange={(e) => {
                    setAnsweredAt(e.target.value || todayIsoDate());
                    markChanged();
                  }}
                  className="w-full min-h-[48px] rounded-2xl border border-emerald-200 bg-white px-4 text-sm text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-900/70">
                  How God answered (optional)
                </span>
                <textarea
                  value={answerNote}
                  maxLength={NOTE_ANSWER_MAX}
                  rows={4}
                  onChange={(e) => {
                    setAnswerNote(e.target.value.slice(0, NOTE_ANSWER_MAX));
                    markChanged();
                  }}
                  placeholder="Write what happened, so you can remember His faithfulness…"
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-[#1A1A1A] leading-relaxed placeholder:text-gray-400 resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setAnsweredAt(null);
                  setAnswerNote('');
                  markChanged();
                }}
              >
                Not answered yet
              </Button>
            </section>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setAnsweredAt(todayIsoDate());
                markChanged();
              }}
            >
              <Check size={18} aria-hidden />
              Mark this prayer answered
            </Button>
          )
        ) : null}

        {saveError ? (
          <p role="alert" className="text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
        {deleteError ? (
          <p role="alert" className="text-sm text-red-700">
            {deleteError}
          </p>
        ) : null}
        {savedFlash && !dirty ? (
          <p role="status" className="text-sm text-emerald-700 font-medium">
            Saved
          </p>
        ) : null}
        {dirty ? (
          <p role="status" className="text-xs text-gray-500">
            Unsaved changes
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pt-1">
          <Button
            type="button"
            className="w-full"
            disabled={saving || deleting}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={saving || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? 'Deleting…' : noteId ? 'Delete' : 'Discard'}
          </Button>
        </div>
      </div>
    </main>
  );
};

export const MemberNoteNewPage: React.FC = () => <MemberNoteEditorPage mode="new" />;
export const MemberNoteEditPage: React.FC = () => <MemberNoteEditorPage mode="edit" />;
