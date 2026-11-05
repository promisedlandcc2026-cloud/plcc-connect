/**
 * Shared Vault reads for Community post ownership checks.
 * Never logs tokens or response bodies.
 */

import { parseVaultSelfUserResponse } from './memberIdentity.js';
import { parseVaultSinglePostResponse } from './communityFeedSanitize.js';
import {
  buildVaultCommunityPostUrl,
  buildVaultSelfUserUrl,
} from './vaultOrigin.js';

/**
 * @param {string} origin
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ ok: true, id: string } | { ok: false, status: number, reason: string }>}
 */
export async function fetchVaultSelfUserId(origin, token, signal) {
  let upstream;
  try {
    upstream = await fetch(buildVaultSelfUserUrl(origin), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
      redirect: 'error',
    });
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, status: 504, reason: 'timeout' };
    return { ok: false, status: 502, reason: 'fetch_failed' };
  }

  if (upstream.status === 401) return { ok: false, status: 401, reason: 'unauthorized' };
  if (upstream.status === 403) return { ok: false, status: 403, reason: 'forbidden' };
  if (!upstream.ok) return { ok: false, status: 502, reason: 'upstream_error' };

  let body;
  try {
    body = await upstream.json();
  } catch {
    return { ok: false, status: 502, reason: 'malformed_self' };
  }

  const parsed = parseVaultSelfUserResponse(body);
  if (parsed.kind !== 'member') {
    return { ok: false, status: 502, reason: 'malformed_self' };
  }
  return { ok: true, id: parsed.member.id };
}

/**
 * @param {string} origin
 * @param {string} token
 * @param {string} postId
 * @param {string} viewerId
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ ok: true, post: object } | { ok: false, status: number, reason: string }>}
 */
export async function fetchVaultSanitizedPost(origin, token, postId, viewerId, signal) {
  let upstream;
  try {
    upstream = await fetch(buildVaultCommunityPostUrl(origin, postId), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
      redirect: 'error',
    });
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, status: 504, reason: 'timeout' };
    return { ok: false, status: 502, reason: 'fetch_failed' };
  }

  if (upstream.status === 401) return { ok: false, status: 401, reason: 'unauthorized' };
  if (upstream.status === 403 || upstream.status === 404) {
    return { ok: false, status: upstream.status, reason: 'unavailable' };
  }
  if (!upstream.ok) return { ok: false, status: 502, reason: 'upstream_error' };

  let body;
  try {
    body = await upstream.json();
  } catch {
    return { ok: false, status: 502, reason: 'malformed_post' };
  }

  const parsed = parseVaultSinglePostResponse(body, { viewerId });
  if (!parsed.ok) {
    return { ok: false, status: 502, reason: 'malformed_post' };
  }
  return { ok: true, post: parsed.post };
}
