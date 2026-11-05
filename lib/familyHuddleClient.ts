import { getValidAccessToken, refreshAccessToken } from './authAccessToken';
import {
  FamilyHuddleError,
  type FamilyHuddleErrorCode,
  type FamilyHuddleInvite,
  type FamilyHuddleJoinToken,
  type FamilyHuddleStatus,
} from './familyHuddleTypes';

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

function mapStatus(
  status: number,
  bodyCode?: string
): { code: FamilyHuddleErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403) {
    if (bodyCode === 'not_adult') {
      return {
        code: 'not_adult',
        message: 'Family Huddle is for household adults only in this version.',
      };
    }
    if (bodyCode === 'unlinked') {
      return {
        code: 'unlinked',
        message: 'Link your member profile before starting a Family Huddle.',
      };
    }
    if (bodyCode === 'conflict') {
      return {
        code: 'conflict',
        message: 'Multiple households are linked. Contact the church office first.',
      };
    }
    if (bodyCode === 'invite_locked') {
      return {
        code: 'invite_locked',
        message: 'This Family Huddle is locked to new guests.',
      };
    }
    if (bodyCode === 'invite_exhausted') {
      return {
        code: 'invite_exhausted',
        message: 'This invite link has reached its guest limit.',
      };
    }
    return {
      code: 'forbidden',
      message: 'Family Huddle is not available for your account.',
    };
  }
  if (status === 404) {
    return { code: 'not_found', message: 'That invite could not be found.' };
  }
  if (status === 410) {
    return {
      code: 'invite_expired',
      message: 'This invite link has expired.',
    };
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
        message: 'Family Huddle is not available right now. Please try again later.',
      };
    }
    return {
      code: 'bridge_unconfigured',
      message: 'Family Huddle is not available right now.',
    };
  }
  return {
    code: 'vault_unavailable',
    message: 'Family Huddle is temporarily unavailable. Please try again.',
  };
}

async function readErrorMeta(
  res: Response
): Promise<{ code?: string; message?: string }> {
  try {
    const body = (await res.clone().json()) as {
      code?: string;
      message?: string;
      error?: string;
    };
    return {
      code: typeof body.code === 'string' ? body.code : undefined,
      message:
        typeof body.message === 'string'
          ? body.message
          : typeof body.error === 'string'
            ? body.error
            : undefined,
    };
  } catch {
    return {};
  }
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new FamilyHuddleError(
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
    if (err instanceof FamilyHuddleError) throw err;
    throw new FamilyHuddleError(
      'network',
      'Family Huddle is temporarily unavailable. Please try again.',
      0
    );
  }
}

export async function fetchFamilyHuddleStatus(): Promise<FamilyHuddleStatus> {
  const res = await authedFetch('/api/family-huddle?resource=status', {
    method: 'GET',
  });
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
  const body = (await res.json()) as Partial<FamilyHuddleStatus> & { ok?: boolean };
  return {
    configured: Boolean(body.configured !== false),
    live: Boolean(body.live),
    participantCount:
      typeof body.participantCount === 'number' ? body.participantCount : 0,
    householdName:
      typeof body.householdName === 'string' ? body.householdName : null,
  };
}

export async function fetchFamilyHuddleToken(): Promise<FamilyHuddleJoinToken> {
  const res = await authedFetch('/api/family-huddle?resource=token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
  const body = (await res.json()) as Partial<FamilyHuddleJoinToken>;
  if (!body.token || !body.url || !body.roomName) {
    throw new FamilyHuddleError(
      'vault_unavailable',
      'Family Huddle token was incomplete.',
      502
    );
  }
  return {
    token: body.token,
    url: body.url,
    roomName: body.roomName,
    expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : 0,
    canModerate: Boolean(body.canModerate),
    isGuest: Boolean(body.isGuest),
    displayName:
      typeof body.displayName === 'string' ? body.displayName : 'Family',
    householdName:
      typeof body.householdName === 'string' ? body.householdName : null,
  };
}

export async function endFamilyHuddle(): Promise<void> {
  const res = await authedFetch('/api/family-huddle?resource=end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
}

export async function createFamilyHuddleInvite(): Promise<FamilyHuddleInvite> {
  const res = await authedFetch('/api/family-huddle?resource=invite-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
  const body = (await res.json()) as Partial<FamilyHuddleInvite>;
  if (!body.code || !body.path) {
    throw new FamilyHuddleError(
      'vault_unavailable',
      'Invite was incomplete.',
      502
    );
  }
  return {
    code: body.code,
    path: body.path,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
    maxUses: typeof body.maxUses === 'number' ? body.maxUses : 10,
    householdName:
      typeof body.householdName === 'string' ? body.householdName : null,
  };
}

export async function lockFamilyHuddleInvites(): Promise<void> {
  const res = await authedFetch('/api/family-huddle?resource=invite-lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
}

/** Public guest redeem — no church account required. */
export async function redeemFamilyHuddleInvite(
  code: string,
  displayName: string
): Promise<FamilyHuddleJoinToken> {
  let res: Response;
  try {
    res = await fetch('/api/family-huddle?resource=invite-redeem', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: code, displayName }),
    });
  } catch {
    throw new FamilyHuddleError(
      'network',
      'Family Huddle is temporarily unavailable. Please try again.',
      0
    );
  }
  if (!res.ok) {
    const meta = await readErrorMeta(res);
    const mapped = mapStatus(res.status, meta.code);
    throw new FamilyHuddleError(
      mapped.code,
      meta.message || mapped.message,
      res.status
    );
  }
  const body = (await res.json()) as Partial<FamilyHuddleJoinToken>;
  if (!body.token || !body.url || !body.roomName) {
    throw new FamilyHuddleError(
      'vault_unavailable',
      'Could not join with that invite.',
      502
    );
  }
  return {
    token: body.token,
    url: body.url,
    roomName: body.roomName,
    expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : 0,
    canModerate: false,
    isGuest: true,
    displayName:
      typeof body.displayName === 'string' ? body.displayName : displayName,
    householdName:
      typeof body.householdName === 'string' ? body.householdName : null,
  };
}
