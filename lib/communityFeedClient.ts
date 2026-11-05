import { isSupabaseConfigured, supabase } from './supabase';
import {
  CommunityFeedError,
  type CommunityFeedErrorCode,
  type CommunityFeedPage,
} from './communityFeedTypes';

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[community-feed client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function mapStatus(status: number): { code: CommunityFeedErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      message: 'Community is not available for this account yet.',
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

function parsePage(body: unknown): CommunityFeedPage | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.posts)) return null;
  return {
    posts: b.posts as CommunityFeedPage['posts'],
    pageSize: typeof b.pageSize === 'number' ? b.pageSize : 20,
    offset: typeof b.offset === 'number' ? b.offset : 0,
    hasMore: Boolean(b.hasMore),
    skipped: typeof b.skipped === 'number' ? b.skipped : 0,
  };
}

export async function fetchCommunityFeedPage(opts?: {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<CommunityFeedPage> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityFeedError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  let res: Response;
  try {
    res = await fetch(`/api/community-feed?${qs.toString()}`, {
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
    const mapped = mapStatus(res.status);
    throw new CommunityFeedError(mapped.code, mapped.message, res.status);
  }

  const page = parsePage(body);
  if (!page) {
    throw new CommunityFeedError(
      'malformed_response',
      'Community is temporarily unavailable. Please try again.',
      res.status || 502
    );
  }

  return page;
}
