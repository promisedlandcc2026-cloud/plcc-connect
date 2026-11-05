/**
 * Phase 2.5 — private sermon notes types (client-safe).
 */

export type SermonNoteSourceType = 'sermon' | 'youtube' | 'manual';

/** What kind of entry — sermon notes, a prayer, a reflection, or gratitude. */
export type NoteEntryType = 'sermon' | 'prayer' | 'reflection' | 'gratitude';
export const NOTE_ENTRY_TYPES: NoteEntryType[] = ['sermon', 'prayer', 'reflection', 'gratitude'];

export type SermonNote = {
  id: string;
  userId: string;
  sermonId: string | null;
  sourceType: SermonNoteSourceType;
  sourceRef: string | null;
  title: string | null;
  content: string;
  sermonTitle: string | null;
  speakerName: string | null;
  sermonDate: string | null;
  entryType: NoteEntryType;
  /** Prayer entries only: YYYY-MM-DD the member marked it answered. */
  answeredAt: string | null;
  /** Prayer entries only: "How God answered". */
  answerNote: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Safe context for starting a note — never invents missing metadata. */
export type SermonNoteStartContext = {
  sourceType: SermonNoteSourceType;
  sermonId?: string | null;
  sourceRef?: string | null;
  title?: string | null;
  sermonTitle?: string | null;
  speakerName?: string | null;
  sermonDate?: string | null;
  entryType?: NoteEntryType | null;
};

export const SERMON_NOTE_TITLE_MAX = 200;
export const SERMON_NOTE_CONTENT_MAX = 50000;
export const NOTE_ANSWER_MAX = 2000;
