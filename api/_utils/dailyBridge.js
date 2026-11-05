/**
 * Daily devotional bridge (public — visitors can read it too):
 *   GET /api/daily?date=YYYY-MM-DD → PLCC Vault /api/vault?resource=daily&action=week
 * Returns Monday–Sunday of that week (church-written days, starter set otherwise).
 * Rides on api/vault-news.js (bridge=daily) for the Hobby function limit.
 * Read-only: staff write devotionals in the Vault itself.
 */
import { parseVaultApiOrigin } from './vaultOrigin.js';

const TIMEOUT_MS = 12000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNAVAILABLE = 'Today’s devotional is not available right now. Please try again.';

export function dailyUpstreamQuery(query) {
  const date = String(query?.date || '').trim();
  const qs = new URLSearchParams({ resource: 'daily', action: 'week' });
  if (DAY_RE.test(date)) qs.set('date', date);
  return qs.toString();
}

export async function handleDailyBridge(req, res) {
  const send = (status, body) => res.status(status).json(body);
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { ok: false, code: 'method_not_allowed', error: 'Method not allowed.' });
  }
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[daily] VAULT_API_ORIGIN invalid:', originResult.reason);
    return send(503, { ok: false, code: 'bridge_unconfigured', error: UNAVAILABLE });
  }
  const url = `${String(originResult.origin).replace(/\/+$/, '')}/api/vault?${dailyUpstreamQuery(req.query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal, redirect: 'error' });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !data || data.ok !== true || !Array.isArray(data.days)) {
      console.error('[daily] upstream status', upstream.status);
      return send(502, { ok: false, code: 'vault_unavailable', error: UNAVAILABLE });
    }
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300');
    return send(200, {
      ok: true,
      today: String(data.today || ''),
      monday: String(data.monday || ''),
      seriesTitle: data.seriesTitle ? String(data.seriesTitle) : null,
      days: data.days.slice(0, 7).map((d) => ({
        day: String(d.day || ''),
        source: d.source === 'church' ? 'church' : 'starter',
        title: String(d.title || ''),
        ref: String(d.ref || ''),
        verseText: d.verseText ? String(d.verseText) : null,
        body: String(d.body || ''),
        question: d.question ? String(d.question) : null,
        prayer: d.prayer ? String(d.prayer) : null,
      })),
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[daily] error:', aborted ? 'timeout' : 'network');
    return send(502, { ok: false, code: 'vault_unavailable', error: UNAVAILABLE });
  } finally {
    clearTimeout(timer);
  }
}
