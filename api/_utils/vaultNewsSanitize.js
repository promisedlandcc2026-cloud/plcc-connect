/** Vault News + health DTO sanitizers for the Connect bridge. */

export const VAULT_NEWS_KINDS = new Set(['church', 'database', 'celebration', 'sympathy']);
export const VAULT_NEWS_POST_ROLES = new Set(['SUPER_ADMIN', 'PASTOR', 'MINISTRY_LEADER']);
export const MAX_NEWS_TITLE = 120;
export const MAX_NEWS_BODY = 1000;
export const MAX_NEWS_POST_BODY_BYTES = 4096;
export const MAX_NEWS_ITEMS = 20;

/**
 * @param {unknown} kind
 * @returns {'church' | 'database' | 'celebration' | 'sympathy'}
 */
export function normalizeNewsKind(kind) {
  const k = String(kind || 'church').trim().toLowerCase();
  return VAULT_NEWS_KINDS.has(k) ? k : 'church';
}

/**
 * @param {unknown} row
 * @returns {null | {
 *   id: string,
 *   created_at: string | null,
 *   title: string,
 *   body: string,
 *   kind: string,
 *   author_name: string | null,
 *   author_role: string | null,
 * }}
 */
export function sanitizeNewsItem(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const id = String(r.id || '').trim();
  const title = String(r.title || '').trim();
  const body = String(r.body || '').trim();
  if (!id || !title || !body) return null;
  if (title.length > MAX_NEWS_TITLE) return null;
  if (body.length > MAX_NEWS_BODY) return null;
  const created = r.created_at == null ? null : String(r.created_at);
  const authorName = r.author_name == null ? null : String(r.author_name).trim() || null;
  const authorRole = r.author_role == null ? null : String(r.author_role).trim() || null;
  return {
    id,
    created_at: created,
    title,
    body,
    kind: normalizeNewsKind(r.kind),
    author_name: authorName,
    author_role: authorRole,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, news: ReturnType<typeof sanitizeNewsItem>[], needsSetup: boolean, database: 'healthy' | 'unavailable' | null } | { ok: false, reason: string }}
 */
export function parseVaultNewsListResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid' };
  }
  const r = /** @type {Record<string, unknown>} */ (body);
  if (r.ok === false) return { ok: false, reason: 'upstream_error' };
  const database = r.database === 'unavailable' ? 'unavailable' : r.database === 'healthy' ? 'healthy' : null;
  const raw = Array.isArray(r.news) ? r.news : [];
  const news = [];
  for (const row of raw) {
    const item = sanitizeNewsItem(row);
    if (item) news.push(item);
    if (news.length >= MAX_NEWS_ITEMS) break;
  }
  return {
    ok: true,
    news,
    needsSetup: r.needsSetup === true,
    database,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, item: NonNullable<ReturnType<typeof sanitizeNewsItem>> } | { ok: false, reason: string }}
 */
export function parseVaultNewsItemResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid' };
  }
  const r = /** @type {Record<string, unknown>} */ (body);
  if (r.ok === false) return { ok: false, reason: 'upstream_error' };
  const item = sanitizeNewsItem(r.item);
  if (!item) return { ok: false, reason: 'invalid_item' };
  return { ok: true, item };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, title: string, body: string, kind: string } | { ok: false, reason: string }}
 */
export function parseNewsPostCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  const r = /** @type {Record<string, unknown>} */ (raw);
  const allowed = new Set(['title', 'body', 'kind']);
  for (const key of Object.keys(r)) {
    if (!allowed.has(key)) return { ok: false, reason: 'extra_fields' };
  }
  const title = String(r.title || '').trim();
  const body = String(r.body || '').trim();
  const kindRaw = String(r.kind || 'church').trim().toLowerCase();
  if (!title || title.length > MAX_NEWS_TITLE) return { ok: false, reason: 'invalid_title' };
  if (!body || body.length > MAX_NEWS_BODY) return { ok: false, reason: 'invalid_body_text' };
  if (!VAULT_NEWS_KINDS.has(kindRaw)) return { ok: false, reason: 'invalid_kind' };
  return { ok: true, title, body, kind: kindRaw };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, database: 'healthy' | 'unavailable' } | { ok: false, reason: string }}
 */
export function parseVaultHealthResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid' };
  }
  const r = /** @type {Record<string, unknown>} */ (body);
  if (r.database === 'healthy') return { ok: true, database: 'healthy' };
  if (r.database === 'unavailable') return { ok: true, database: 'unavailable' };
  return { ok: false, reason: 'invalid_status' };
}
