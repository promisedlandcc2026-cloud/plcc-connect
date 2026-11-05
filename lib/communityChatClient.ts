import { getValidAccessToken, refreshAccessToken } from './authAccessToken';
import {
  CommunityChatError,
  type ChatDirectoryMember,
  type CommunityChatChannel,
  type CommunityChatErrorCode,
  type CommunityChatMessage,
  type HuddleChannelStatus,
  type HuddleJoinToken,
} from './communityChatTypes';

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

/** Shown when a member opens a huddle nobody has started (only leaders / room moderators can start). */
export const HUDDLE_NOT_STARTED_MESSAGE =
  "This huddle hasn't started yet. A leader or room moderator will start it — you can join as soon as it's live.";

function mapStatus(
  status: number,
  bodyCode?: string
): { code: CommunityChatErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403 && bodyCode === 'huddle_not_started') {
    return { code: 'huddle_not_started', message: HUDDLE_NOT_STARTED_MESSAGE };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      message: 'You do not have access to this chat.',
    };
  }
  if (status === 404) {
    return { code: 'not_found', message: 'That channel could not be found.' };
  }
  if (status === 429) {
    return {
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    };
  }
  if (status === 503) {
    if (bodyCode === 'huddle_unavailable') {
      return {
        code: 'huddle_unavailable',
        message: 'Live Huddle is not available right now. Please try again later.',
      };
    }
    return {
      code: 'bridge_unconfigured',
      message: 'Chat is not available right now. Please try again later.',
    };
  }
  return {
    code: 'vault_unavailable',
    message: 'Chat is temporarily unavailable. Please try again.',
  };
}

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { code?: string };
    return typeof body.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

async function authedFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new CommunityChatError(
      'session_missing',
      'Please sign in again to continue.',
      401,
      true
    );
  }

  const doFetch = async (bearer: string) =>
    fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
        Authorization: `Bearer ${bearer}`,
      },
    });

  try {
    let res = await doFetch(token);
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        res = await doFetch(refreshed);
      }
    }
    return res;
  } catch (err) {
    if (err instanceof CommunityChatError) throw err;
    throw new CommunityChatError(
      'network',
      'Chat is temporarily unavailable. Please try again.',
      0
    );
  }
}

export async function fetchChatChannels(opts?: {
  signal?: AbortSignal;
}): Promise<CommunityChatChannel[]> {
  const res = await authedFetch('/api/community-chat?resource=channels', {
    method: 'GET',
    signal: opts?.signal,
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    channels?: CommunityChatChannel[];
  };
  if (body.ok !== true || !Array.isArray(body.channels)) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return body.channels;
}

export async function fetchChatMessages(
  channelId: string,
  opts?: { signal?: AbortSignal }
): Promise<CommunityChatMessage[]> {
  const qs = new URLSearchParams({ resource: 'messages', channelId });
  const res = await authedFetch(`/api/community-chat?${qs}`, {
    method: 'GET',
    signal: opts?.signal,
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    messages?: CommunityChatMessage[];
  };
  if (body.ok !== true || !Array.isArray(body.messages)) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return body.messages;
}

export async function sendChatMessage(
  channelId: string,
  content: string
): Promise<CommunityChatMessage> {
  const res = await authedFetch('/api/community-chat?resource=messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, content }),
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    message?: CommunityChatMessage;
  };
  if (body.ok !== true || !body.message) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return body.message;
}

export async function fetchChatUnread(opts?: {
  signal?: AbortSignal;
}): Promise<{ count: number; byChannel: Record<string, number> }> {
  const res = await authedFetch('/api/community-chat?resource=unread', {
    method: 'GET',
    signal: opts?.signal,
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    count?: number;
    byChannel?: Record<string, number>;
  };
  if (body.ok !== true) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return {
    count: typeof body.count === 'number' ? body.count : 0,
    byChannel: body.byChannel && typeof body.byChannel === 'object' ? body.byChannel : {},
  };
}

export async function markChatChannelRead(channelId: string): Promise<void> {
  const res = await authedFetch('/api/community-chat?resource=unread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId }),
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
}

/**
 * Batch LIVE huddle presence for known channel IDs (~10s poll on Chat list).
 */
export async function fetchHuddleStatuses(
  channelIds: string[],
  opts?: { signal?: AbortSignal }
): Promise<Record<string, HuddleChannelStatus>> {
  if (channelIds.length === 0) return {};
  const qs = new URLSearchParams({
    resource: 'huddle-status',
    channelIds: channelIds.join(','),
  });
  const res = await authedFetch(`/api/community-chat?${qs}`, {
    method: 'GET',
    signal: opts?.signal,
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    const mapped = mapStatus(res.status, code);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    byChannel?: Record<string, HuddleChannelStatus>;
  };
  if (body.ok !== true || !body.byChannel || typeof body.byChannel !== 'object') {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return body.byChannel;
}

/**
 * Mint a Vault LiveKit join token (also starts an empty room on Vault).
 */
export async function fetchHuddleToken(
  channelId: string
): Promise<HuddleJoinToken> {
  const res = await authedFetch('/api/community-chat?resource=huddle-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId }),
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    const mapped = mapStatus(res.status, code);
    let sessionInvalid = false;
    if (res.status === 401) {
      const again = await getAccessToken();
      sessionInvalid = !again;
    }
    throw new CommunityChatError(mapped.code, mapped.message, res.status, sessionInvalid);
  }
  const body = (await res.json()) as Partial<HuddleJoinToken> & { ok?: boolean };
  if (
    body.ok !== true ||
    typeof body.token !== 'string' ||
    typeof body.url !== 'string' ||
    typeof body.roomName !== 'string' ||
    typeof body.channelId !== 'string'
  ) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Live Huddle is temporarily unavailable. Please try again.',
      502
    );
  }
  return {
    token: body.token,
    url: body.url,
    roomName: body.roomName,
    expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : 0,
    canModerate: Boolean(body.canModerate),
    channelId: body.channelId,
    channelName:
      typeof body.channelName === 'string' && body.channelName.trim()
        ? body.channelName
        : 'Channel',
    ...(typeof body.fallbackPass === 'string' && body.fallbackPass ? { fallbackPass: body.fallbackPass } : {}),
  };
}

/** End Live Huddle for everyone (Vault moderator gate). */
export async function endHuddle(channelId: string): Promise<void> {
  const res = await authedFetch('/api/community-chat?resource=huddle-end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId }),
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    const mapped = mapStatus(res.status, code);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
}

/** Search approved members to start a DM (requires non-empty q). */
export async function searchChatDirectory(
  q: string,
  opts?: { signal?: AbortSignal }
): Promise<ChatDirectoryMember[]> {
  const qs = new URLSearchParams({ resource: 'directory', q: q.trim() });
  const res = await authedFetch(`/api/community-chat?${qs}`, {
    method: 'GET',
    signal: opts?.signal,
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    members?: ChatDirectoryMember[];
  };
  if (body.ok !== true || !Array.isArray(body.members)) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return body.members;
}

/** Get-or-create a DM channel with a member. */
export async function openDirectMessage(
  partnerId: string
): Promise<{ channel: CommunityChatChannel; partnerId: string }> {
  const res = await authedFetch('/api/community-chat?resource=dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partnerId }),
  });
  if (!res.ok) {
    const mapped = mapStatus(res.status);
    throw new CommunityChatError(
      mapped.code,
      mapped.message,
      res.status,
      res.status === 401
    );
  }
  const body = (await res.json()) as {
    ok?: boolean;
    channel?: CommunityChatChannel;
    partnerId?: string;
  };
  if (body.ok !== true || !body.channel?.id) {
    throw new CommunityChatError(
      'vault_unavailable',
      'Chat is temporarily unavailable. Please try again.',
      502
    );
  }
  return {
    channel: body.channel,
    partnerId: typeof body.partnerId === 'string' ? body.partnerId : partnerId,
  };
}
