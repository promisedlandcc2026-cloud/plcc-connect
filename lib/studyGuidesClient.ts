/**
 * Sermon study guides published in RhemaNotes and shown in PLCC Vault's
 * "Sermon Notes" page. Same-origin bridge: /api/study-guides → Vault.
 */
import { getValidAccessToken, refreshAccessToken } from './authAccessToken';

export type StudyGuideCard = {
  id: string;
  title: string;
  theme: string;
  speaker: string;
  summary: string;
  dayCount: number;
  publishedAt: string;
  shareToken: string;
  shareUrl: string | null;
};

export type StudyGuideDay = {
  dayNumber: number;
  title: string;
  scriptureReference: string;
  scriptureText: string;
  observation: string;
  application: string;
  prayer: string;
  challenge: string;
  groupDiscussion: string;
};

export type StudyGuide = StudyGuideCard & {
  keyVerse: string;
  keyVerseReference: string;
  centralMessage: string;
  keyPoints: string[];
  quotes: string[];
  applications: string[];
  prayers: string[];
  reflections: string[];
  scriptures: Array<{ reference: string; note: string }>;
  days: StudyGuideDay[];
  coverUrl: string | null;
};

export const STUDY_GUIDE_TOKEN_RE = /^[a-f0-9]{24}$/i;

async function authedGet(path: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Please sign in again to continue.');
  let res = await fetch(path, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (next) res = await fetch(path, { headers: { Accept: 'application/json', Authorization: `Bearer ${next}` } });
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

function failMessage(body: Record<string, unknown> | null): string {
  return typeof body?.message === 'string' ? body.message : 'Sermon study guides are temporarily unavailable. Please try again.';
}

export async function fetchStudyGuides(): Promise<StudyGuideCard[]> {
  const { status, body } = await authedGet('/api/study-guides');
  if (status !== 200 || body?.ok !== true || !Array.isArray(body.guides)) throw new Error(failMessage(body));
  return body.guides as StudyGuideCard[];
}

export async function fetchStudyGuide(shareToken: string): Promise<StudyGuide> {
  if (!STUDY_GUIDE_TOKEN_RE.test(shareToken)) throw new Error('That study guide link is not valid.');
  const { status, body } = await authedGet(`/api/study-guides?token=${encodeURIComponent(shareToken)}`);
  if (status !== 200 || body?.ok !== true || !body.guide) throw new Error(failMessage(body));
  return body.guide as StudyGuide;
}

/** "October 11, 2026" from an ISO date/time. */
export function formatGuideDate(value: string): string {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
