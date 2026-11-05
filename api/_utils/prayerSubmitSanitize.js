/**
 * Prayer Wall submit — what Connect accepts and forwards to the Vault.
 * The Vault decides the rest (members post straight to the wall, visitors wait for review).
 */

export const PRAYER_MAX_CHARS = 2000;
export const PRAYER_NAME_MAX_CHARS = 80;
export const MAX_PRAYER_BODY_BYTES = 16 * 1024;

const ALLOWED_KEYS = new Set(['content', 'member_name', 'is_confidential', 'is_anonymous', 'website', 'share_with']);
const SHARE_WITH = new Set(['wall', 'intercessors', 'pastor']);

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * @param {unknown} body
 * @param {{ signedIn: boolean }} opts
 * @returns {{ ok: true, payload: Record<string, unknown> } | { ok: false, reason: string }}
 */
export function parsePrayerSubmit(body, opts) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'invalid_body' };
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, reason: 'invalid_body' };
  }
  const b = /** @type {Record<string, unknown>} */ (body);
  if (clean(b.website, 200)) return { ok: false, reason: 'invalid_body' };
  const raw = String(b.content ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty_content' };
  if (raw.length > PRAYER_MAX_CHARS) return { ok: false, reason: 'content_too_long' };
  const share = typeof b.share_with === 'string' && SHARE_WITH.has(b.share_with) ? b.share_with : null;
  if (b.share_with != null && !share) return { ok: false, reason: 'invalid_body' };
  const payload = {
    content: clean(raw, PRAYER_MAX_CHARS),
    is_confidential: share ? share !== 'wall' : b.is_confidential === true,
  };
  if (share) payload.share_with = share;
  if (opts.signedIn) {
    payload.is_anonymous = b.is_anonymous === true;
  } else {
    const name = clean(b.member_name, PRAYER_NAME_MAX_CHARS);
    if (!name) return { ok: false, reason: 'missing_name' };
    payload.member_name = name;
  }
  return { ok: true, payload };
}

/**
 * Only the status comes back to the browser.
 * @param {unknown} body
 * @returns {'Published' | 'Vetting' | 'Confidential' | null}
 */
export function parseVaultPrayerResponse(body) {
  if (!body || typeof body !== 'object') return null;
  const status = String(/** @type {Record<string, unknown>} */ (body).status || '');
  return status === 'Published' || status === 'Vetting' || status === 'Confidential' ? status : null;
}
