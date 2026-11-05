/**
 * GET /api/bible?status=1                → { ok, niv } — is NIV set up? (no sign-in needed)
 * GET /api/bible?t=niv&chapter=JHN.3     → { ok, verses:[{n,text}], copyright, fumsToken } (signed-in)
 *
 * KJV is public domain and served as static files from /bible/kjv; only licensed
 * translations come through here. NIV text comes from API.Bible with the church's key:
 *   API_BIBLE_KEY       — API.Bible key (never sent to the browser)
 *   API_BIBLE_NIV_ID    — the NIV Bible id from API.Bible's Bibles list
 *   API_BIBLE_BASE      — optional, defaults to https://rest.api.bible/v1
 * Rides on api/vault-news.js (bridge=bible) for the Hobby function limit.
 */
import { parseBearerAuthorization } from './memberIdentity.js';

const TIMEOUT_MS = 15000;
const UNAVAILABLE = 'NIV isn’t available right now. Please try again, or switch to KJV.';
const NOT_SET_UP = 'NIV isn’t set up yet. KJV is available.';
const CHAPTER_RE = /^(?:[1-3][A-Z]{2}|[A-Z]{3})\.(\d{1,3})$/;
const BIBLE_ID_RE = /^[A-Za-z0-9-]{4,64}$/;

function config() {
  const key = String(process.env.API_BIBLE_KEY || '').trim();
  const nivId = String(process.env.API_BIBLE_NIV_ID || '').trim();
  let base = String(process.env.API_BIBLE_BASE || 'https://rest.api.bible/v1').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(\/[a-z0-9/._-]*)?$/i.test(base)) base = 'https://rest.api.bible/v1';
  const niv = Boolean(key && BIBLE_ID_RE.test(nivId));
  return { key, nivId, base, niv };
}

/**
 * API.Bible "text" content with verse numbers looks like "     [1] In the beginning … [2] And …".
 * Split on the [n] markers into verses; collapse whitespace.
 */
export function parseApiBibleText(content) {
  const text = String(content || '');
  const verses = [];
  const re = /\[(\d{1,3})\]\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ n: Number(m[1]), start: m.index, end: re.lastIndex });
  for (let i = 0; i < marks.length; i += 1) {
    const body = text
      .slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : text.length)
      .replace(/\s+/g, ' ')
      .trim();
    if (body) verses.push({ n: marks[i].n, text: body.slice(0, 2000) });
  }
  return verses;
}

export async function handleBibleBridge(req, res) {
  const send = (status, body) => res.status(status).json(body);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { ok: false, code: 'method_not_allowed', message: 'This endpoint only supports GET.' });
  }

  const cfg = config();

  if (req.query?.status) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return send(200, { ok: true, kjv: true, niv: cfg.niv });
  }

  res.setHeader('Cache-Control', 'private, no-store');

  const translation = String(req.query?.t || '').toLowerCase();
  if (translation !== 'niv') {
    return send(400, { ok: false, code: 'invalid_translation', message: 'That translation isn’t available here.' });
  }
  if (!cfg.niv) return send(503, { ok: false, code: 'not_configured', message: NOT_SET_UP });

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return send(401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });

  const chapterId = String(req.query?.chapter || '').toUpperCase();
  const cm = chapterId.match(CHAPTER_RE);
  if (!cm || Number(cm[1]) < 1 || Number(cm[1]) > 150) {
    return send(400, { ok: false, code: 'invalid_chapter', message: 'That chapter wasn’t found.' });
  }

  const params = new URLSearchParams({
    'content-type': 'text',
    'include-notes': 'false',
    'include-titles': 'false',
    'include-chapter-numbers': 'false',
    'include-verse-numbers': 'true',
    'fums-version': '3',
  });
  const url = `${cfg.base}/bibles/${encodeURIComponent(cfg.nivId)}/chapters/${encodeURIComponent(chapterId)}?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      headers: { 'api-key': cfg.key, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (upstream.status === 404) {
      return send(404, { ok: false, code: 'not_found', message: 'That chapter wasn’t found.' });
    }
    if (!upstream.ok) {
      console.error('[bible] API.Bible responded', upstream.status);
      return send(502, { ok: false, code: 'upstream_error', message: UNAVAILABLE });
    }
    const body = await upstream.json().catch(() => null);
    const verses = parseApiBibleText(body?.data?.content);
    if (!verses.length) {
      console.error('[bible] API.Bible returned no verses for', chapterId);
      return send(502, { ok: false, code: 'upstream_error', message: UNAVAILABLE });
    }
    const copyright = typeof body?.data?.copyright === 'string' ? body.data.copyright.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
    const fumsToken = typeof body?.meta?.fumsToken === 'string' ? body.meta.fumsToken.slice(0, 2000) : '';
    return send(200, { ok: true, verses, copyright, fumsToken });
  } catch (err) {
    console.error('[bible] API.Bible request failed:', err?.name === 'AbortError' ? 'timeout' : 'network');
    return send(504, { ok: false, code: 'upstream_timeout', message: UNAVAILABLE });
  } finally {
    clearTimeout(timer);
  }
}
