import { isSupabaseConfigured, supabase } from './supabase';
import {
  CommunityFeedError,
  type CommunityFeedErrorCode,
  type CommunityFeedPost,
} from './communityFeedTypes';

export const COMMUNITY_POST_MAX_CHARS = 3000;

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[community-post client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function mapReadStatus(status: number): { code: CommunityFeedErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      message: 'This post is unavailable or you may not have permission to view it.',
    };
  }
  if (status === 404) {
    return {
      code: 'not_found',
      message: 'This post is no longer available.',
    };
  }
  if (status === 429) {
    return {
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    };
  }
  if (status === 503) {
    return {
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    };
  }
  return {
    code: 'vault_unavailable',
    message: 'Community is temporarily unavailable. Please try again.',
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCommunityPostId(id: string): boolean {
  return UUID_RE.test(String(id || '').trim());
}

function parsePost(body: unknown): CommunityFeedPost | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !b.post || typeof b.post !== 'object') return null;
  const raw = b.post as CommunityFeedPost;
  return {
    ...raw,
    authoredByMe: Boolean(raw.authoredByMe),
    canEditOwnPost: Boolean(raw.canEditOwnPost),
    canDeleteOwnPost: Boolean(raw.canDeleteOwnPost),
  };
}

export async function fetchCommunityPost(
  postId: string,
  opts?: { signal?: AbortSignal }
): Promise<CommunityFeedPost> {
  const id = String(postId || '').trim();
  if (!isValidCommunityPostId(id)) {
    throw new CommunityFeedError(
      'invalid_query',
      'That post link is not valid.',
      400
    );
  }

  const token = await getAccessToken();
  if (!token) {
    throw new CommunityFeedError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  const qs = new URLSearchParams({ id });
  let res: Response;
  try {
    res = await fetch(`/api/community-post?${qs.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: opts?.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new CommunityFeedError(
      'network',
      'Community is temporarily unavailable. Please try again.',
      0
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new CommunityFeedError('unauthorized', 'Please sign in again to continue.', 401, !again);
  }

  if (!res.ok) {
    const mapped = mapReadStatus(res.status);
    const msg =
      body &&
      typeof body === 'object' &&
      typeof (body as { message?: unknown }).message === 'string'
        ? String((body as { message: string }).message)
        : mapped.message;
    throw new CommunityFeedError(mapped.code, msg, res.status);
  }

  const post = parsePost(body);
  if (!post) {
    throw new CommunityFeedError(
      'malformed_response',
      'Community is temporarily unavailable. Please try again.',
      res.status || 502
    );
  }

  return post;
}

export type CreateCommunityPostInput = {
  content: string;
  image?: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    fileBase64: string;
  };
};

/**
 * Create a Community post via same-origin POST /api/community-posts.
 * Never logs tokens or content. Caller must prevent duplicate submits.
 */
export async function createCommunityPost(
  input: CreateCommunityPostInput
): Promise<CommunityFeedPost> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityFeedError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  const body: Record<string, unknown> = {
    content: input.content,
  };
  if (input.image) {
    body.image = {
      mimeType: input.image.mimeType,
      fileBase64: input.image.fileBase64,
    };
  }

  let res: Response;
  try {
    res = await fetch('/api/community-posts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new CommunityFeedError(
      'network',
      'We couldn’t publish your post. Your draft is still here so you can try again.',
      0
    );
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new CommunityFeedError('unauthorized', 'Please sign in again to continue.', 401, !again);
  }

  if (!res.ok) {
    const msg =
      parsedBody &&
      typeof parsedBody === 'object' &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? String((parsedBody as { message: string }).message)
        : 'We couldn’t publish your post. Your draft is still here so you can try again.';
    const codeFromBody =
      parsedBody &&
      typeof parsedBody === 'object' &&
      typeof (parsedBody as { code?: unknown }).code === 'string'
        ? String((parsedBody as { code: string }).code)
        : null;

    if (res.status === 403) {
      throw new CommunityFeedError(
        'forbidden',
        'Community is not available for this account yet.',
        403
      );
    }
    if (res.status === 429) {
      throw new CommunityFeedError(
        'rate_limited',
        'Too many requests. Please wait a moment and try again.',
        429
      );
    }
    if (res.status === 503) {
      throw new CommunityFeedError(
        'bridge_unconfigured',
        'Community is not available right now. Please try again later.',
        503
      );
    }
    if (codeFromBody === 'empty_content') {
      throw new CommunityFeedError(
        'vault_unavailable',
        'Write something or add a photo before posting.',
        400
      );
    }
    if (codeFromBody === 'content_too_long') {
      throw new CommunityFeedError(
        'vault_unavailable',
        'That post is too long. Please shorten it and try again.',
        400
      );
    }
    if (codeFromBody === 'unsupported_image' || res.status === 415) {
      throw new CommunityFeedError(
        'vault_unavailable',
        'Please choose a JPG, PNG, or WebP image.',
        res.status || 400
      );
    }
    if (codeFromBody === 'image_too_large' || res.status === 413) {
      throw new CommunityFeedError(
        'vault_unavailable',
        'That photo is too large. Please choose a smaller image.',
        res.status || 413
      );
    }

    throw new CommunityFeedError('vault_unavailable', msg, res.status || 502);
  }

  const post = parsePost(parsedBody);
  if (!post) {
    throw new CommunityFeedError(
      'malformed_response',
      'We couldn’t publish your post. Your draft is still here so you can try again.',
      res.status || 502
    );
  }

  return post;
}

const MANAGE_PRIVACY =
  'You cannot manage this post, or it may no longer be available.';

export async function editOwnCommunityPost(
  postId: string,
  content: string
): Promise<CommunityFeedPost> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityFeedError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  let res: Response;
  try {
    res = await fetch('/api/community-post-manage', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'edit',
        postId,
        content,
      }),
      cache: 'no-store',
    });
  } catch {
    throw new CommunityFeedError(
      'network',
      'We couldn’t update that post right now. Please try again.',
      0
    );
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new CommunityFeedError('unauthorized', 'Please sign in again to continue.', 401, !again);
  }

  if (!res.ok) {
    const msg =
      parsedBody &&
      typeof parsedBody === 'object' &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? String((parsedBody as { message: string }).message)
        : res.status === 403 || res.status === 404
          ? MANAGE_PRIVACY
          : 'We couldn’t update that post right now. Please try again.';
    throw new CommunityFeedError(
      res.status === 403
        ? 'forbidden'
        : res.status === 404
          ? 'not_found'
          : res.status === 429
            ? 'rate_limited'
            : 'vault_unavailable',
      msg,
      res.status || 502
    );
  }

  const post = parsePost(parsedBody);
  if (!post) {
    throw new CommunityFeedError(
      'malformed_response',
      'We couldn’t update that post right now. Please try again.',
      res.status || 502
    );
  }
  return post;
}

export async function deleteOwnCommunityPost(postId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityFeedError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  let res: Response;
  try {
    res = await fetch('/api/community-post-manage', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'delete',
        postId,
      }),
      cache: 'no-store',
    });
  } catch {
    throw new CommunityFeedError(
      'network',
      'We couldn’t update that post right now. Please try again.',
      0
    );
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new CommunityFeedError('unauthorized', 'Please sign in again to continue.', 401, !again);
  }

  if (!res.ok) {
    const msg =
      parsedBody &&
      typeof parsedBody === 'object' &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? String((parsedBody as { message: string }).message)
        : res.status === 403 || res.status === 404
          ? MANAGE_PRIVACY
          : 'We couldn’t update that post right now. Please try again.';
    throw new CommunityFeedError(
      res.status === 403
        ? 'forbidden'
        : res.status === 404
          ? 'not_found'
          : res.status === 429
            ? 'rate_limited'
            : 'vault_unavailable',
      msg,
      res.status || 502
    );
  }

  if (
    !parsedBody ||
    typeof parsedBody !== 'object' ||
    (parsedBody as { ok?: unknown }).ok !== true ||
    (parsedBody as { action?: unknown }).action !== 'delete'
  ) {
    throw new CommunityFeedError(
      'malformed_response',
      'We couldn’t update that post right now. Please try again.',
      res.status || 502
    );
  }
}
