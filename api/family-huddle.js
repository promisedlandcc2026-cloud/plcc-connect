/**
 * Hobby-friendly multi-resource entry:
 *   - Family Huddle bridge → Vault resource=family
 *   - Latest YouTube (formerly api/latest-youtube.js) under resource=youtube
 *
 * Public URL `/api/latest-youtube` is preserved via vercel rewrite + vite middleware.
 *
 * GET  /api/family-huddle?resource=status
 * POST /api/family-huddle?resource=token
 * POST /api/family-huddle?resource=end
 * POST /api/family-huddle?resource=invite-create
 * POST /api/family-huddle?resource=invite-redeem  { token, displayName }  (no auth)
 * POST /api/family-huddle?resource=invite-lock
 * GET  /api/family-huddle?resource=youtube  (or /api/latest-youtube rewrite)
 * GET  /api/family-huddle?resource=kids-view&cardRef=AWCD.…  (Kids View + PLCC Bucks, read-only)
 * POST /api/family-huddle?resource=kids-theme  { cardRef, kidsTheme }
 */

import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_FAMILY_HUDDLE_BODY_BYTES,
  parseFamilyHuddleEndResponse,
  parseFamilyHuddleStatusResponse,
  parseFamilyHuddleTokenResponse,
  parseFamilyInviteCreateResponse,
  parseGuestRedeemBody,
} from './_utils/familyHuddleSanitize.js';
import {
  MAX_KIDS_THEME_BODY_BYTES,
  parseKidsCardRef,
  parseKidsThemeBody,
  parseKidsViewResponse,
} from './_utils/kidsViewSanitize.js';
import {
  buildVaultFamilyHuddleUrl,
  buildVaultKidsThemeUrl,
  buildVaultKidsViewUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 15000;
const TOKEN_UPSTREAM_TIMEOUT_MS = 20000;

const AUTHED_RESOURCES = new Set([
  'status',
  'token',
  'end',
  'invite-create',
  'invite-lock',
  'kids-view',
  'kids-theme',
]);
const PUBLIC_RESOURCES = new Set(['invite-redeem', 'youtube']);
const ALLOWED_RESOURCES = new Set([...AUTHED_RESOURCES, ...PUBLIC_RESOURCES]);

const CHURCH_YOUTUBE_CHANNEL_ID = 'UCecsx4U61ap-pbkLV42hcUA'; // PLCC GRACELOVE

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  if (status !== 200 || body?.ok === false) {
    setPrivateNoStore(res);
  }
  res.status(status).json(body);
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** First <entry> in the channel Atom feed — same source Watch uses for URL. */
export function parseLatestEntry(xml) {
  const entryMatch = String(xml || '').match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch) return null;
  const entry = entryMatch[1];
  const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] ?? null;
  const titleRaw = entry.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
  const published = entry.match(/<published>([^<]+)<\/published>/i)?.[1] ?? null;
  const title = decodeXmlEntities(titleRaw).trim();
  if (!videoId) return null;
  return { videoId, title: title || null, published };
}

async function handleYoutube(_req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CHURCH_YOUTUBE_CHANNEL_ID}`
    );
    if (!response.ok) {
      return res.status(502).json({ error: 'Could not reach YouTube feed' });
    }
    const xml = await response.text();
    const latest = parseLatestEntry(xml);
    if (!latest?.videoId) {
      return res.status(404).json({ error: 'No videos found in feed' });
    }
    return res.status(200).json({
      url: `https://www.youtube.com/watch?v=${latest.videoId}`,
      videoId: latest.videoId,
      title: latest.title,
      published: latest.published,
    });
  } catch (error) {
    console.error('latest-youtube API error:', error);
    return res.status(500).json({ error: 'Failed to fetch latest video' });
  }
}

function mapUpstreamError(res, status, body) {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const message =
    typeof body?.error === 'string'
      ? body.error
      : typeof body?.message === 'string'
        ? body.message
        : undefined;

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
      code: code || 'forbidden',
      message: message || 'Family Huddle is not available for your account.',
    });
  }
  if (status === 404) {
    return json(res, 404, {
      ok: false,
      code: code || 'not_found',
      message: message || 'That invite could not be found.',
    });
  }
  if (status === 410) {
    return json(res, 410, {
      ok: false,
      code: code || 'invite_expired',
      message: message || 'This invite link has expired.',
    });
  }
  if (status === 429) {
    return json(res, 429, {
      ok: false,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }
  if (status === 400) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: message || 'Please check your request and try again.',
    });
  }
  if (status === 503) {
    return json(res, 503, {
      ok: false,
      code: code || 'huddle_unavailable',
      message: message || 'Family Huddle is not available right now.',
    });
  }
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Family Huddle is temporarily unavailable. Please try again.',
  });
}

function parseResource(query) {
  const resource = String(query?.resource || '').trim().toLowerCase();
  if (!ALLOWED_RESOURCES.has(resource)) {
    return { ok: false, reason: 'invalid_resource' };
  }
  return { ok: true, resource };
}

/**
 * @param {{ method?: string, headers?: any, query?: any, body?: any, url?: string }} req
 * @param {any} res
 */
export default async function handler(req, res) {
  let resourceResult = parseResource(req.query || {});
  // Preserve /api/latest-youtube (vercel rewrite may omit query in some runtimes)
  if (!resourceResult.ok) {
    const urlStr = String(req.url || '');
    if (urlStr.includes('latest-youtube') || req.query?.from === 'latest-youtube') {
      resourceResult = { ok: true, resource: 'youtube' };
    } else {
      setPrivateNoStore(res);
      return json(res, 400, {
        ok: false,
        code: 'invalid_query',
        message: 'That Family Huddle request was not valid.',
      });
    }
  }
  const resource = resourceResult.resource;

  if (resource === 'youtube') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, {
        ok: false,
        code: 'method_not_allowed',
        message: 'YouTube feed only supports GET.',
      });
    }
    return handleYoutube(req, res);
  }

  setPrivateNoStore(res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET and POST.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[family-huddle] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Family Huddle is not available right now.',
    });
  }

  /** @type {string | null} */
  let bearer = null;
  if (AUTHED_RESOURCES.has(resource)) {
    const auth = parseBearerAuthorization(req.headers?.authorization);
    if (!auth.ok) {
      return json(res, 401, {
        ok: false,
        code: 'unauthorized',
        message: 'Please sign in again to continue.',
      });
    }
    bearer = auth.token;
  }

  const needsTokenTimeout =
    resource === 'token' || resource === 'invite-redeem' || resource === 'end';
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    needsTokenTimeout ? TOKEN_UPSTREAM_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS
  );

  try {
    if (resource === 'status') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Status only supports GET.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'status'),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseFamilyHuddleStatusResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Family Huddle status was unexpected.',
        });
      }
      return json(res, 200, {
        ok: true,
        configured: parsed.configured,
        live: parsed.live,
        participantCount: parsed.participantCount,
        householdName: parsed.householdName,
      });
    }

    if (resource === 'token') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Token only supports POST.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'token'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: '{}',
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseFamilyHuddleTokenResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Family Huddle token was unexpected.',
        });
      }
      return json(res, 200, { ok: true, ...parsed.token });
    }

    if (resource === 'end') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'End only supports POST.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'end'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: '{}',
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseFamilyHuddleEndResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Could not confirm Family Huddle end.',
        });
      }
      return json(res, 200, { ok: true, ended: parsed.ended });
    }

    if (resource === 'invite-create') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Invite create only supports POST.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'invite-create'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: '{}',
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseFamilyInviteCreateResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Invite response was unexpected.',
        });
      }
      return json(res, 200, {
        ok: true,
        code: parsed.code,
        path: parsed.path,
        expiresAt: parsed.expiresAt,
        maxUses: parsed.maxUses,
        householdName: parsed.householdName,
      });
    }

    if (resource === 'invite-lock') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Invite lock only supports POST.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'invite-lock'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: '{}',
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      return json(res, 200, { ok: true, locked: true });
    }

    if (resource === 'kids-view') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Kids View only supports GET.',
        });
      }
      const cardRef = parseKidsCardRef(req.query?.cardRef);
      if (!cardRef) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_card_ref',
          message: 'That child card link is not valid.',
        });
      }
      const upstream = await fetch(buildVaultKidsViewUrl(originResult.origin, cardRef), {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${bearer}` },
        signal: controller.signal,
      });
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseKidsViewResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Kids View was unexpected. Please try again.',
        });
      }
      return json(res, 200, { ok: true, ...parsed.view });
    }

    if (resource === 'kids-theme') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Kids View theme only supports POST.',
        });
      }
      if (JSON.stringify(req.body || {}).length > MAX_KIDS_THEME_BODY_BYTES) {
        return json(res, 413, { ok: false, code: 'body_too_large', message: 'That request is too large.' });
      }
      const parsedBody = parseKidsThemeBody(req.body);
      if (!parsedBody.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message: 'Choose Soft Garden or Adventure.',
        });
      }
      const upstream = await fetch(buildVaultKidsThemeUrl(originResult.origin), {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ cardRef: parsedBody.cardRef, kidsTheme: parsedBody.kidsTheme }),
        signal: controller.signal,
      });
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      return json(res, 200, { ok: true, theme: parsedBody.kidsTheme });
    }

    if (resource === 'invite-redeem') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Invite redeem only supports POST.',
        });
      }
      const bodySize = JSON.stringify(req.body || {}).length;
      if (bodySize > MAX_FAMILY_HUDDLE_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'body_too_large',
          message: 'That request is too large.',
        });
      }
      const parsedBody = parseGuestRedeemBody(req.body);
      if (!parsedBody.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message:
            parsedBody.reason === 'invalid_name'
              ? 'Enter a display name (up to 40 characters).'
              : 'Enter a valid invite code and display name.',
        });
      }
      const upstream = await fetch(
        buildVaultFamilyHuddleUrl(originResult.origin, 'invite-redeem'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: parsedBody.token,
            displayName: parsedBody.displayName,
          }),
          signal: controller.signal,
        }
      );
      let raw = null;
      try {
        raw = await upstream.json();
      } catch {
        raw = null;
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, raw);
      const parsed = parseFamilyHuddleTokenResponse(raw);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Could not join with that invite.',
        });
      }
      return json(res, 200, { ok: true, ...parsed.token, isGuest: true });
    }

    return json(res, 400, {
      ok: false,
      code: 'invalid_query',
      message: 'That Family Huddle request was not valid.',
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    console.error('[family-huddle]', aborted ? 'timeout' : err?.message || err);
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Family Huddle is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
