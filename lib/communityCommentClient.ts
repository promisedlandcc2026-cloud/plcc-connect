import { isSupabaseConfigured, supabase } from './supabase';
import {
  CommunityCommentsError,
  type CommunityCommentsErrorCode,
  type CommunityCommentsList,
  type ConnectCommunityComment,
} from './communityCommentTypes';

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[community-comments client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function mapStatus(status: number): { code: CommunityCommentsErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403 || status === 404) {
    return {
      code: status === 404 ? 'not_found' : 'forbidden',
      message:
        'We couldn’t complete that. The comment may be unavailable or you may no longer have access.',
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
      message: 'Comments are not available right now. Please try again later.',
    };
  }
  return {
    code: 'vault_unavailable',
    message: 'Comments are temporarily unavailable. Please try again.',
  };
}

async function authorizedFetch(
  init: RequestInit
): Promise<{ res: Response; body: unknown }> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityCommentsError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  let res: Response;
  try {
    res = await fetch('/api/community-comments', {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new CommunityCommentsError(
      'network',
      'Comments are temporarily unavailable. Please try again.',
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
    throw new CommunityCommentsError(
      'unauthorized',
      'Please sign in again to continue.',
      401,
      !again
    );
  }

  if (!res.ok) {
    const mapped = mapStatus(res.status);
    const msg =
      body &&
      typeof body === 'object' &&
      typeof (body as { message?: unknown }).message === 'string'
        ? String((body as { message: string }).message)
        : mapped.message;
    throw new CommunityCommentsError(mapped.code, msg, res.status);
  }

  return { res, body };
}

export async function fetchCommunityComments(
  postId: string,
  opts?: { signal?: AbortSignal }
): Promise<CommunityCommentsList> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityCommentsError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  const qs = new URLSearchParams({ postId });
  let response: Response;
  try {
    response = await fetch(`/api/community-comments?${qs.toString()}`, {
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
    throw new CommunityCommentsError(
      'network',
      'Comments are temporarily unavailable. Please try again.',
      0
    );
  }

  let listBody: unknown = null;
  try {
    listBody = await response.json();
  } catch {
    listBody = null;
  }

  if (response.status === 401) {
    const again = await getAccessToken();
    throw new CommunityCommentsError(
      'unauthorized',
      'Please sign in again to continue.',
      401,
      !again
    );
  }
  if (!response.ok) {
    const mapped = mapStatus(response.status);
    const msg =
      listBody &&
      typeof listBody === 'object' &&
      typeof (listBody as { message?: unknown }).message === 'string'
        ? String((listBody as { message: string }).message)
        : mapped.message;
    throw new CommunityCommentsError(mapped.code, msg, response.status);
  }

  if (!listBody || typeof listBody !== 'object') {
    throw new CommunityCommentsError(
      'malformed_response',
      'Comments are temporarily unavailable. Please try again.',
      502
    );
  }
  const b = listBody as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.comments)) {
    throw new CommunityCommentsError(
      'malformed_response',
      'Comments are temporarily unavailable. Please try again.',
      502
    );
  }

  return {
    comments: b.comments as ConnectCommunityComment[],
    postId: typeof b.postId === 'string' ? b.postId : postId,
    hasMore: Boolean(b.hasMore),
    truncated: Boolean(b.truncated),
    skipped: typeof b.skipped === 'number' ? b.skipped : 0,
  };
}

export async function createCommunityComment(
  postId: string,
  content: string,
  opts?: { signal?: AbortSignal }
): Promise<ConnectCommunityComment> {
  const { body } = await authorizedFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, content }),
    signal: opts?.signal,
  });
  const b = body as { comment?: ConnectCommunityComment };
  if (!b?.comment) {
    throw new CommunityCommentsError(
      'malformed_response',
      'Comments are temporarily unavailable. Please try again.',
      502
    );
  }
  return b.comment;
}

export async function editCommunityComment(
  commentId: string,
  content: string,
  opts?: { signal?: AbortSignal }
): Promise<ConnectCommunityComment> {
  const { body } = await authorizedFetch({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commentId, content }),
    signal: opts?.signal,
  });
  const b = body as { comment?: ConnectCommunityComment };
  if (!b?.comment) {
    throw new CommunityCommentsError(
      'malformed_response',
      'Comments are temporarily unavailable. Please try again.',
      502
    );
  }
  return b.comment;
}

export async function deleteCommunityComment(
  commentId: string,
  opts?: { signal?: AbortSignal }
): Promise<void> {
  await authorizedFetch({
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commentId }),
    signal: opts?.signal,
  });
}
