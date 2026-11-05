/**
 * Sermon study guides (RhemaNotes, via Vault) — sanitize what Connect sends to
 * the browser. Text only, clipped; links only when https.
 */

export const SHARE_TOKEN_RE = /^[a-f0-9]{24}$/i;

function clip(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clipList(value, maxItems, maxLen) {
  return Array.isArray(value)
    ? value.map((v) => clip(v, maxLen)).filter(Boolean).slice(0, maxItems)
    : [];
}

function httpsUrl(value) {
  const raw = clip(value, 1000);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeGuideCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const shareToken = clip(raw.shareToken, 40);
  if (!SHARE_TOKEN_RE.test(shareToken)) return null;
  return {
    id: clip(raw.id, 80) || shareToken,
    title: clip(raw.title, 200) || 'Study guide',
    theme: clip(raw.theme, 300),
    speaker: clip(raw.speaker, 120),
    summary: clip(raw.summary, 4000),
    dayCount: Number.isFinite(Number(raw.dayCount)) ? Math.max(0, Math.min(14, Number(raw.dayCount))) : 0,
    publishedAt: clip(raw.publishedAt, 40),
    shareToken,
    shareUrl: httpsUrl(raw.shareUrl),
  };
}

function sanitizeDay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dayNumber = Number(raw.dayNumber);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return null;
  return {
    dayNumber,
    title: clip(raw.title, 200),
    scriptureReference: clip(raw.scriptureReference, 120),
    scriptureText: clip(raw.scriptureText, 4000),
    observation: clip(raw.observation, 4000),
    application: clip(raw.application, 4000),
    prayer: clip(raw.prayer, 4000),
    challenge: clip(raw.challenge, 2000),
    groupDiscussion: clip(raw.groupDiscussion, 2000),
  };
}

export function sanitizeGuide(raw) {
  const card = sanitizeGuideCard(raw);
  if (!card) return null;
  return {
    ...card,
    keyVerse: clip(raw.keyVerse, 400),
    keyVerseReference: clip(raw.keyVerseReference, 80),
    centralMessage: clip(raw.centralMessage, 800),
    keyPoints: clipList(raw.keyPoints, 12, 400),
    quotes: clipList(raw.quotes, 8, 400),
    applications: clipList(raw.applications, 8, 400),
    prayers: clipList(raw.prayers, 8, 400),
    reflections: clipList(raw.reflections, 8, 400),
    scriptures: Array.isArray(raw.scriptures)
      ? raw.scriptures
          .map((s) => (s && typeof s === 'object' ? { reference: clip(s.reference, 120), note: clip(s.note, 400) } : null))
          .filter((s) => s && s.reference)
          .slice(0, 20)
      : [],
    days: Array.isArray(raw.days) ? raw.days.map(sanitizeDay).filter(Boolean).slice(0, 14) : [],
    coverUrl: httpsUrl(raw.coverUrl),
  };
}
