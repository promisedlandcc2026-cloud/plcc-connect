import { handleSsoBridge } from './_utils/ssoBridge.js';
import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import { handleCheckinPointsBridge } from './_utils/checkinPointsBridge.js';
import { handleStudyGuidesBridge } from './_utils/studyGuidesBridge.js';
import { handlePrayerBridge } from './_utils/prayerBridge.js';
import { handleIntercessorsBridge } from './_utils/intercessorsBridge.js';
import {
  MAX_NEWS_POST_BODY_BYTES,
  parseNewsPostCommand,
  parseVaultHealthResponse,
  parseVaultNewsItemResponse,
  parseVaultNewsListResponse,
} from './_utils/vaultNewsSanitize.js';
import {
  buildVaultHealthUrl,
  buildVaultNewsUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';
import { handleBibleBridge } from './_utils/bibleBridge.js';
import { handleArkBridge } from './_utils/arkBridge.js';
import { handleGalleryBridge } from './_utils/galleryBridge.js';
import { handlePushBridge } from './_utils/pushBridge.js';
import { handleDailyBridge } from './_utils/dailyBridge.js';

const NEWS_TIMEOUT_MS = 12000;
const HEALTH_TIMEOUT_MS = 8000;

function setNoStore(res, visibility = 'private') {
  res.setHeader('Cache-Control', `${visibility}, no-store`);
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  res.status(status).json(body);
}

function isPointsBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'points';
}

function isStudyGuidesBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'study-guides';
}

function isPrayerBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'prayer';
}

function isIntercessorsBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'intercessors';
}

function isGalleryBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'gallery';
}

function isArkBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'ark';
}

function isBibleBridge(req) {
  return String(req.query?.bridge || '').toLowerCase() === 'bible';
}

function isHealthProbe(req) {
  const probe = String(req.query?.probe || req.query?.resource || '').toLowerCase();
  return probe === 'health';
}

function originOr503(res, logLabel) {
  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error(`[${logLabel}] VAULT_API_ORIGIN invalid:`, originResult.reason);
    return null;
  }
  return originResult.origin;
}

async function handleHealth(req, res) {
  setNoStore(res, 'no-cache');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: true, database: 'unavailable' });
  }

  const origin = originOr503(res, 'vault-health');
  if (!origin) {
    return json(res, 200, { ok: true, database: 'unavailable' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildVaultHealthUrl(origin), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      redirect: 'error',
    });
    let body;
    try {
      body = await upstream.json();
    } catch {
      return json(res, 200, { ok: true, database: 'unavailable' });
    }
    const parsed = parseVaultHealthResponse(body);
    return json(res, 200, {
      ok: true,
      database: parsed.ok ? parsed.database : 'unavailable',
    });
  } catch {
    return json(res, 200, { ok: true, database: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
}

function mapNewsUpstreamError(res, status) {
  if (status === 401) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }
  if (status === 403) {
    return json(res, 403, {
      ok: false,
      code: 'forbidden',
      message: 'Only Pastor, Ministry Leader, and Super Admin can post Canaan News.',
    });
  }
  if (status === 400) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'Please check the title, note, and kind, then try again.',
    });
  }
  if (status === 429) {
    return json(res, 429, {
      ok: false,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }
  console.error('[vault-news] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Canaan News is temporarily unavailable. Please try again.',
  });
}

/**
 * Narrow same-origin bridge:
 * GET  /api/vault-news          → Vault GET  resource=vault-news (signed-in)
 * POST /api/vault-news          → Vault POST resource=vault-news (staff roles on Vault)
 * GET  /api/vault-health        → Vault GET  resource=health (unauthenticated; always HTTP 200)
 * *    /api/checkin-points       → check-in points / member pass / season (see _utils/checkinPointsBridge.js)
 * GET  /api/study-guides        → RhemaNotes sermon study guides (see _utils/studyGuidesBridge.js)
 * POST /api/prayer              → Prayer Wall requests (see _utils/prayerBridge.js)
 * GET  /api/intercessors        → Intercessors prayer list (see _utils/intercessorsBridge.js)
 * GET  /api/bible               → licensed Bible text, NIV via API.Bible (see _utils/bibleBridge.js)
 * *    /api/ark                 → PLCC Ark scores + leaderboards (see _utils/arkBridge.js)
 * POST /api/sso                 → PLCC ONE sign-on token for PLCC Chat (see _utils/ssoBridge.js)
 * GET  /api/gallery             → church photo gallery from the website (see _utils/galleryBridge.js)
 *
 * The extra routes ride on this function via vercel.json rewrites (Hobby function-count limit).
 * Fixed upstream. Never logs Authorization tokens. Never forwards cookies.
 */
export default async function handler(req, res) {
  if (String(req.query?.bridge || '').toLowerCase() === 'daily') {
    return handleDailyBridge(req, res);
  }
  if (String(req.query?.bridge || '').toLowerCase() === 'push') {
    return handlePushBridge(req, res);
  }
  if (isArkBridge(req)) {
    return handleArkBridge(req, res);
  }
  if (String(req.query?.bridge || '').toLowerCase() === 'sso') {
    return handleSsoBridge(req, res);
  }
  if (isGalleryBridge(req)) {
    return handleGalleryBridge(req, res);
  }

  if (isBibleBridge(req)) {
    return handleBibleBridge(req, res);
  }
  if (isPrayerBridge(req)) {
    return handlePrayerBridge(req, res);
  }
  if (isIntercessorsBridge(req)) {
    return handleIntercessorsBridge(req, res);
  }
  if (isPointsBridge(req)) {
    return handleCheckinPointsBridge(req, res);
  }
  if (isStudyGuidesBridge(req)) {
    return handleStudyGuidesBridge(req, res);
  }
  if (isHealthProbe(req)) {
    return handleHealth(req, res);
  }

  setNoStore(res, 'private');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET and POST.',
    });
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }

  const origin = originOr503(res, 'vault-news');
  if (!origin) {
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Canaan News is not available right now. Please try again later.',
    });
  }

  if (req.method === 'POST') {
    const raw = req.body;
    if (raw === null) {
      return json(res, 413, {
        ok: false,
        code: 'payload_too_large',
        message: 'That news item is too large.',
      });
    }
    try {
      const encoded = Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf8');
      if (encoded > MAX_NEWS_POST_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'payload_too_large',
          message: 'That news item is too large.',
        });
      }
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'Please check the title, note, and kind, then try again.',
      });
    }
    const parsed = parseNewsPostCommand(raw);
    if (!parsed.ok) {
      return json(res, 400, {
        ok: false,
        code: parsed.reason,
        message:
          parsed.reason === 'invalid_kind'
            ? 'Choose Church, Database, Celebration, or Sympathy.'
            : parsed.reason === 'invalid_title'
              ? 'Add a title of 120 characters or less.'
              : parsed.reason === 'invalid_body_text'
                ? 'Add a note of 1,000 characters or less.'
                : 'Please check the title, note, and kind, then try again.',
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NEWS_TIMEOUT_MS);
    try {
      const upstream = await fetch(buildVaultNewsUrl(origin), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: parsed.title,
          body: parsed.body,
          kind: parsed.kind,
        }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) {
        if (upstream.status === 503) {
          let setup;
          try {
            setup = await upstream.json();
          } catch {
            setup = null;
          }
          return json(res, 503, {
            ok: false,
            code: 'needs_setup',
            message:
              typeof setup?.error === 'string'
                ? setup.error
                : 'Canaan News is not available right now. Please try again later.',
          });
        }
        return mapNewsUpstreamError(res, upstream.status);
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Canaan News is temporarily unavailable. Please try again.',
        });
      }
      const item = parseVaultNewsItemResponse(body);
      if (!item.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Canaan News is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 201, { ok: true, item: item.item });
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      console.error('[vault-news] post error:', aborted ? 'timeout' : 'network');
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Canaan News is temporarily unavailable. Please try again.',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildVaultNewsUrl(origin), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!upstream.ok) {
      return mapNewsUpstreamError(res, upstream.status);
    }
    let body;
    try {
      body = await upstream.json();
    } catch {
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Canaan News is temporarily unavailable. Please try again.',
      });
    }
    const parsed = parseVaultNewsListResponse(body);
    if (!parsed.ok) {
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Canaan News is temporarily unavailable. Please try again.',
      });
    }
    return json(res, 200, {
      ok: true,
      news: parsed.news,
      needsSetup: parsed.needsSetup,
      ...(parsed.database ? { database: parsed.database } : {}),
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[vault-news] get error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Canaan News is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
