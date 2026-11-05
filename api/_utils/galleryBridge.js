/**
 * GET /api/gallery → { ok, leah:[…], church:[…], videos:[…], syncedAt }
 *
 * The same photos as the website's Gallery (sanctum-live-nine.vercel.app/gallery):
 *   - Leah's photography, live from the website's Pixieset sync (/api/gallery/pixieset)
 *   - church photos and videos, from the website's build-time /gallery-feed.json
 *   - photos staff uploaded in the website admin (/api/gallery)
 * Public photos only — no sign-in needed. Cached for an hour.
 * Rides on api/vault-news.js (bridge=gallery) for the Hobby function limit.
 *   AWC_SITE_ORIGIN — optional, defaults to https://sanctum-live-nine.vercel.app
 */

const TIMEOUT_MS = 12000;
const TTL_MS = 60 * 60 * 1000;
const MAX_ITEMS = 600;

const LEAH_CREDIT = { name: 'Leah', url: 'https://leah6583.pixieset.com/anointedworshipcenter/' };

/** Old promo graphics in the admin table that aren't church photography. */
const LEGACY_PROMO = [
  '/images/home-hero',
  '/images/mens-ministry',
  '/images/womens-ministry',
  '/images/youth-ministry',
  '/images/children-ministry',
  '/images/worship-arts',
  '/images/community-outreach',
  '/images/awc-welcome',
  'youtube.com/embed/dQw4w9WgXcQ',
];

let cache = { at: 0, body: null };

function siteOrigin() {
  const raw = String(process.env.AWC_SITE_ORIGIN || 'https://sanctum-live-nine.vercel.app').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+$/i.test(raw) ? raw : 'https://sanctum-live-nine.vercel.app';
}

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : undefined);

/** Only https URLs (relative paths are made absolute against the website). */
function safeUrl(v, origin) {
  const s = str(v, 1000).trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return `${origin}${s}`;
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
}

/** Whitelist the fields the app shows. */
export function sanitizeGalleryItem(raw, origin, extra = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'video' ? 'video' : 'image';
  const url = safeUrl(raw.url, origin);
  if (!url) return null;
  return {
    id: str(raw.id, 120) || url,
    type,
    url,
    thumbnail: safeUrl(raw.thumbnail, origin) || (type === 'image' ? url : ''),
    title: str(raw.title, 160) || 'Promised Land Christian Center',
    category: str(raw.category, 60),
    description: str(raw.description, 300) || undefined,
    width: num(raw.width),
    height: num(raw.height),
    ...extra,
  };
}

function isLegacyPromo(item) {
  return LEGACY_PROMO.some((s) => item.url.includes(s) || (item.thumbnail || '').includes(s));
}

export async function buildGalleryFeed(origin = siteOrigin()) {
  const [leahRes, feedRes, uploadsRes] = await Promise.allSettled([
    Promise.resolve({ items: [] }), // AWC's Pixieset album is not PLCC's
    getJson(`${origin}/gallery-feed.json`),
    getJson(`${origin}/api/gallery`),
  ]);

  const leah = (leahRes.status === 'fulfilled' && Array.isArray(leahRes.value?.items) ? leahRes.value.items : [])
    .map((i) => sanitizeGalleryItem(i, origin, { credit: LEAH_CREDIT }))
    .filter((i) => i && i.type === 'image');

  const feed = feedRes.status === 'fulfilled' ? feedRes.value : null;
  const churchPhotos = (Array.isArray(feed?.photos) ? feed.photos : []).map((i) => sanitizeGalleryItem(i, origin)).filter(Boolean);
  const churchVideos = (Array.isArray(feed?.videos) ? feed.videos : []).map((i) => sanitizeGalleryItem(i, origin)).filter(Boolean);

  const known = new Set([...churchPhotos, ...churchVideos].map((i) => i.url));
  const uploads = (uploadsRes.status === 'fulfilled' && Array.isArray(uploadsRes.value) ? uploadsRes.value : [])
    .map((i) => sanitizeGalleryItem(i, origin))
    .filter((i) => i && !known.has(i.url) && !isLegacyPromo(i));

  return {
    leah: leah.slice(0, MAX_ITEMS),
    church: [...churchPhotos, ...uploads.filter((i) => i.type === 'image')].slice(0, MAX_ITEMS),
    videos: [...churchVideos, ...uploads.filter((i) => i.type === 'video')].slice(0, 100),
    // Partial results are still useful; tell the app which parts are missing.
    partial: [leahRes, feedRes].some((r) => r.status !== 'fulfilled'),
  };
}

export async function handleGalleryBridge(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'method_not_allowed', message: 'This endpoint only supports GET.' });
  }

  const fresh = cache.body && Date.now() - cache.at < TTL_MS;
  if (!fresh) {
    try {
      const body = await buildGalleryFeed();
      const total = body.leah.length + body.church.length + body.videos.length;
      // Never replace a good cache with an empty or partial one.
      if (total > 0 && (!body.partial || !cache.body)) cache = { at: Date.now(), body };
    } catch (err) {
      console.error('[gallery bridge]', err?.message || err);
    }
  }

  if (!cache.body) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, code: 'unavailable', message: 'We couldn’t load the gallery. Please try again.' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ ok: true, ...cache.body, syncedAt: new Date(cache.at).toISOString() });
}
