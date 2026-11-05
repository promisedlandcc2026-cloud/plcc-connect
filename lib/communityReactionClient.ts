import { isSupabaseConfigured, supabase } from './supabase';
import {
  CommunityFeedError,
  type CommunityFeedErrorCode,
  type CommunityFeedReaction,
  type CommunityReactionKey,
  type CommunityReactionResult,
} from './communityFeedTypes';
import {
  applyOptimisticReactionToggle as applyOptimisticReactionToggleJs,
  reactionStateKey as reactionStateKeyJs,
} from '../api/_utils/communityReactionOptimistic.js';

const ALLOWED: ReadonlySet<string> = new Set(['love', 'pray', 'praise', 'like']);

export type CommunityReactionTargetType = 'post' | 'comment';

export function reactionStateKey(
  targetType: CommunityReactionTargetType,
  targetId: string
): string {
  return reactionStateKeyJs(targetType, targetId);
}

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[community-reaction client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function mapStatus(
  status: number,
  targetType: CommunityReactionTargetType
): { code: CommunityFeedErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403 || status === 404) {
    return {
      code: status === 404 ? 'not_found' : 'forbidden',
      message:
        targetType === 'comment'
          ? 'We couldn’t update that reaction. The comment may no longer be available.'
          : 'We couldn’t update your reaction. The post may be unavailable or you may no longer have access.',
    };
  }
  if (status === 409) {
    return {
      code: 'vault_unavailable',
      message: 'Your reaction could not be saved. Please refresh and try again.',
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
    message: 'We couldn’t update your reaction right now. Please try again.',
  };
}

function parseResult(
  body: unknown,
  targetType: CommunityReactionTargetType,
  targetId: string
): CommunityReactionResult | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.ok !== true) return null;
  if (b.action !== 'insert' && b.action !== 'delete') return null;
  if (!Array.isArray(b.reactions)) return null;
  const resolvedType =
    b.targetType === 'post' || b.targetType === 'comment' ? b.targetType : targetType;
  const resolvedId =
    typeof b.targetId === 'string'
      ? b.targetId
      : typeof b.postId === 'string'
        ? b.postId
        : targetId;
  return {
    targetType: resolvedType,
    targetId: resolvedId,
    postId: resolvedType === 'post' ? resolvedId : undefined,
    action: b.action,
    reactions: b.reactions as CommunityFeedReaction[],
  };
}

/** Optimistic toggle for UNIQUE (target, user, reaction) — multi-reaction allowed. */
export function applyOptimisticReactionToggle(
  reactions: CommunityFeedReaction[],
  reaction: CommunityReactionKey
): CommunityFeedReaction[] {
  return applyOptimisticReactionToggleJs(reactions, reaction) as CommunityFeedReaction[];
}

export async function toggleCommunityReaction(
  targetType: CommunityReactionTargetType,
  targetId: string,
  reaction: CommunityReactionKey,
  opts?: { signal?: AbortSignal }
): Promise<CommunityReactionResult> {
  if (!ALLOWED.has(reaction)) {
    throw new CommunityFeedError('invalid_query', 'That reaction is not supported.', 400);
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

  const body =
    targetType === 'post'
      ? { postId: targetId, reaction }
      : { targetType, targetId, reaction };

  let res: Response;
  try {
    res = await fetch('/api/community-reaction', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: opts?.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new CommunityFeedError(
      'network',
      'We couldn’t update your reaction right now. Please try again.',
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
    const mapped = mapStatus(res.status, targetType);
    const msg =
      parsedBody &&
      typeof parsedBody === 'object' &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? String((parsedBody as { message: string }).message)
        : mapped.message;
    throw new CommunityFeedError(mapped.code, msg, res.status);
  }

  const result = parseResult(parsedBody, targetType, targetId);
  if (!result) {
    throw new CommunityFeedError(
      'malformed_response',
      'We couldn’t update your reaction right now. Please try again.',
      502
    );
  }
  return result;
}
