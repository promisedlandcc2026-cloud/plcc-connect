/**
 * Connect Serve member client — Bearer JWT to /api/serve.
 * Never sends client eligibility/identity ownership fields.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import type { ServeEligibilitySummary, ServeMyItem, ServeOpportunity } from './serveUi';
import { asServeUuid, mapServeMemberError } from './serveUi';

export class ServeClientError extends Error {
  code: string;
  status: number;
  sessionInvalid: boolean;
  eligibility?: ServeEligibilitySummary;

  constructor(
    code: string,
    message: string,
    status = 0,
    sessionInvalid = false,
    eligibility?: ServeEligibilitySummary
  ) {
    super(message);
    this.name = 'ServeClientError';
    this.code = code;
    this.status = status;
    this.sessionInvalid = sessionInvalid;
    this.eligibility = eligibility;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[serve client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function parseEligibility(raw: unknown): ServeEligibilitySummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const status = String(e.status || '');
  if (
    status !== 'not_verified' &&
    status !== 'eligible' &&
    status !== 'ineligible' &&
    status !== 'suspended'
  ) {
    return null;
  }
  return {
    status,
    eligibilitySatisfied: e.eligibilitySatisfied === true,
    signupEnabled: e.signupEnabled === true,
    reasonCode: typeof e.reasonCode === 'string' ? e.reasonCode : 'not_verified',
  };
}

async function authorizedFetch(
  path: string,
  init: RequestInit & { signal?: AbortSignal } = {}
): Promise<{ res: Response; body: unknown }> {
  const token = await getAccessToken();
  if (!token) {
    throw new ServeClientError(
      'session_missing',
      mapServeMemberError('session_missing'),
      401,
      true
    );
  }

  let res: Response;
  try {
    res = await fetch(path, {
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
    throw new ServeClientError('network', mapServeMemberError('network'), 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401) {
    const again = await getAccessToken();
    throw new ServeClientError(
      'unauthorized',
      mapServeMemberError('unauthorized'),
      401,
      !again
    );
  }

  if (!res.ok) {
    const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const code = typeof b.code === 'string' ? b.code : 'serve_unavailable';
    const eligibility = parseEligibility(b.eligibility) || undefined;
    throw new ServeClientError(
      code,
      mapServeMemberError(code, typeof b.message === 'string' ? b.message : undefined),
      res.status,
      false,
      eligibility
    );
  }

  return { res, body };
}

export async function fetchServeEligibility(signal?: AbortSignal): Promise<{
  eligibility: ServeEligibilitySummary;
}> {
  const { body } = await authorizedFetch('/api/serve?resource=eligibility', { method: 'GET', signal });
  const b = body as Record<string, unknown>;
  const eligibility = parseEligibility(b.eligibility);
  if (!eligibility) {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return { eligibility };
}

export async function fetchServeOpportunities(
  filters: { ministryId?: string | null; teamId?: string | null } = {},
  signal?: AbortSignal
): Promise<{ opportunities: ServeOpportunity[]; eligibility: ServeEligibilitySummary | null }> {
  const params = new URLSearchParams({ resource: 'opportunities' });
  const ministryId = asServeUuid(filters.ministryId);
  const teamId = asServeUuid(filters.teamId);
  if (ministryId) params.set('ministryId', ministryId);
  if (teamId) params.set('teamId', teamId);

  const { body } = await authorizedFetch(`/api/serve?${params.toString()}`, {
    method: 'GET',
    signal,
  });
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.opportunities)) {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return {
    opportunities: b.opportunities as ServeOpportunity[],
    eligibility: parseEligibility(b.eligibility),
  };
}

export async function fetchServeOpportunity(
  id: string,
  signal?: AbortSignal
): Promise<{ opportunity: ServeOpportunity; eligibility: ServeEligibilitySummary | null }> {
  const oid = asServeUuid(id);
  if (!oid) {
    throw new ServeClientError('opportunity_not_found', mapServeMemberError('opportunity_not_found'), 404);
  }
  const { body } = await authorizedFetch(
    `/api/serve?resource=opportunity&id=${encodeURIComponent(oid)}`,
    { method: 'GET', signal }
  );
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !b.opportunity || typeof b.opportunity !== 'object') {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return {
    opportunity: b.opportunity as ServeOpportunity,
    eligibility: parseEligibility(b.eligibility),
  };
}

export async function fetchMyServing(signal?: AbortSignal): Promise<{
  items: ServeMyItem[];
  eligibility: ServeEligibilitySummary | null;
}> {
  const { body } = await authorizedFetch('/api/serve?resource=my', { method: 'GET', signal });
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.items)) {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return {
    items: b.items as ServeMyItem[],
    eligibility: parseEligibility(b.eligibility),
  };
}

export async function postServeSignup(opportunityId: string): Promise<{
  result: Record<string, unknown>;
  eligibility: ServeEligibilitySummary | null;
}> {
  const oid = asServeUuid(opportunityId);
  if (!oid) {
    throw new ServeClientError('opportunity_not_found', mapServeMemberError('opportunity_not_found'), 404);
  }
  const { body } = await authorizedFetch('/api/serve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signup', opportunityId: oid }),
  });
  const b = body as Record<string, unknown>;
  if (b.ok !== true) {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return {
    result: (b.result && typeof b.result === 'object' ? b.result : {}) as Record<string, unknown>,
    eligibility: parseEligibility(b.eligibility),
  };
}

export async function postServeCancel(opportunityId: string): Promise<{
  result: Record<string, unknown>;
}> {
  const oid = asServeUuid(opportunityId);
  if (!oid) {
    throw new ServeClientError('opportunity_not_found', mapServeMemberError('opportunity_not_found'), 404);
  }
  const { body } = await authorizedFetch('/api/serve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', opportunityId: oid }),
  });
  const b = body as Record<string, unknown>;
  if (b.ok !== true) {
    throw new ServeClientError('malformed_response', mapServeMemberError('serve_unavailable'), 502);
  }
  return {
    result: (b.result && typeof b.result === 'object' ? b.result : {}) as Record<string, unknown>,
  };
}
