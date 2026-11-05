import { getValidAccessToken, refreshAccessToken } from './authAccessToken';
import { KidsPlansError, type KidsPlan, type KidsPlansErrorCode } from './kidsPlansTypes';

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

function mapStatus(status: number, bodyCode?: string): { code: KidsPlansErrorCode; message: string } {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (status === 403 || bodyCode === 'forbidden') {
    return {
      code: 'forbidden',
      message:
        'Kids Plans are available to kids ministry staff and verified guardians. Contact the church office if you need access.',
    };
  }
  if (status === 503 || bodyCode === 'bridge_unconfigured') {
    return {
      code: 'unavailable',
      message: 'Kids Plans are not available right now. Please try again later.',
    };
  }
  return {
    code: 'unavailable',
    message: 'Kids Plans are temporarily unavailable. Please try again.',
  };
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new KidsPlansError('unauthorized', 'Please sign in again to continue.');
  }

  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  let res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const next = await getAccessToken();
      if (next) {
        headers.set('Authorization', `Bearer ${next}`);
        res = await fetch(path, { ...init, headers });
      }
    }
  }
  return res;
}

function isKidsPlan(row: unknown): row is KidsPlan {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.serviceDate === 'string' &&
    typeof r.classroom === 'string'
  );
}

export type FetchKidsPlansFilters = {
  year?: string;
  classroom?: string;
};

/** Load read-only Kids Plans from Connect bridge (Vault-backed). */
export async function fetchKidsPlans(filters: FetchKidsPlansFilters = {}): Promise<KidsPlan[]> {
  const params = new URLSearchParams();
  const year = String(filters.year || '').trim();
  const classroom = String(filters.classroom || '').trim();
  if (/^\d{4}$/.test(year)) params.set('year', year);
  if (classroom) params.set('classroom', classroom.slice(0, 80));
  const qs = params.toString();
  const path = qs ? `/api/kids-plans?${qs}` : '/api/kids-plans';

  let res: Response;
  try {
    res = await authedFetch(path, { method: 'GET' });
  } catch (err) {
    if (err instanceof KidsPlansError) throw err;
    throw new KidsPlansError('network', 'Could not reach Kids Plans. Check your connection.');
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const mapped = mapStatus(res.status, typeof body?.code === 'string' ? body.code : undefined);
    throw new KidsPlansError(mapped.code, mapped.message);
  }

  if (!body || body.ok !== true || !Array.isArray(body.plans)) {
    throw new KidsPlansError('invalid', 'Kids Plans response was not valid.');
  }

  return body.plans.filter(isKidsPlan);
}
