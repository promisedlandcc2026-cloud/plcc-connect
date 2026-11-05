import { isSupabaseConfigured, supabase } from './supabase';
import type { MentionCandidate } from './communityMentionFormat';
import { MENTION_QUERY_MAX_CHARS, MENTION_QUERY_MIN_CHARS } from './communityMentionFormat';

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[community-mentions client] getSession', error.code || '', error.status || '');
    return null;
  }
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) return null;
  return token;
}

function parseCandidates(body: unknown): MentionCandidate[] | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.ok !== true || !Array.isArray(b.candidates)) return null;
  const out: MentionCandidate[] = [];
  for (const row of b.candidates) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!id || !name) continue;
    out.push({
      id,
      name,
      avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : null,
    });
  }
  return out;
}

/**
 * Search mention candidates. Never logs tokens or search terms.
 * Lookup failure returns empty list (plain-text posting still works).
 */
export async function searchMentionCandidates(
  query: string,
  opts?: { signal?: AbortSignal }
): Promise<MentionCandidate[]> {
  const q = String(query || '').trim();
  if (q.length < MENTION_QUERY_MIN_CHARS || q.length > MENTION_QUERY_MAX_CHARS) {
    return [];
  }
  if (q === '*' || q === '%' || q === '_') return [];

  const token = await getAccessToken();
  if (!token) return [];

  let res: Response;
  try {
    res = await fetch(`/api/community-mentions?q=${encodeURIComponent(q)}`, {
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
    return [];
  }

  if (!res.ok) return [];

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return [];
  }

  return parseCandidates(body) ?? [];
}
