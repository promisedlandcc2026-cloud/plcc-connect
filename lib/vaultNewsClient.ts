import { getValidAccessToken, refreshAccessToken } from './authAccessToken';
import type { VaultNewsItem, VaultNewsKind } from './vaultNews';

export type DatabaseHealth = 'checking' | 'healthy' | 'unavailable';

export class VaultNewsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VaultNewsError';
    this.code = code;
  }
}

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new VaultNewsError('unauthorized', 'Please sign in again to continue.');
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

function isNewsItem(row: unknown): row is VaultNewsItem {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const r = row as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.title === 'string' && typeof r.body === 'string';
}

export type VaultNewsList = {
  news: VaultNewsItem[];
  needsSetup: boolean;
  database: 'healthy' | 'unavailable' | null;
};

export async function fetchDatabaseHealth(): Promise<'healthy' | 'unavailable'> {
  try {
    const res = await fetch('/api/vault-health', { headers: { Accept: 'application/json' } });
    const body = (await res.json().catch(() => null)) as { database?: string } | null;
    return body?.database === 'healthy' ? 'healthy' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function fetchVaultNews(): Promise<VaultNewsList> {
  const res = await authedFetch('/api/vault-news');
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new VaultNewsError(
      String(body?.code || 'unavailable'),
      String(body?.message || 'Canaan News is temporarily unavailable. Please try again.')
    );
  }
  const news = Array.isArray(body?.news) ? body.news.filter(isNewsItem) : [];
  return {
    news,
    needsSetup: body?.needsSetup === true,
    database: body?.database === 'unavailable' ? 'unavailable' : body?.database === 'healthy' ? 'healthy' : null,
  };
}

export async function postVaultNews(input: {
  title: string;
  body: string;
  kind: VaultNewsKind;
}): Promise<VaultNewsItem> {
  const res = await authedFetch('/api/vault-news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new VaultNewsError(
      String(body?.code || 'unavailable'),
      String(body?.message || 'Could not save that news item.')
    );
  }
  if (!isNewsItem(body?.item)) {
    throw new VaultNewsError('unavailable', 'Could not save that news item.');
  }
  return body.item as VaultNewsItem;
}
