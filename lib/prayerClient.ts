import { isSupabaseConfigured, supabase } from './supabase';

export type PrayerSubmitStatus = 'Published' | 'Vetting' | 'Confidential';
export type PrayerShareWith = 'wall' | 'intercessors' | 'pastor';

export class PrayerSubmitError extends Error {}

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token && token.split('.').length === 3 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Sends a prayer to the Prayer Wall through the Vault.
 * Signed-in members: public prayers go straight on the wall. Visitors: a leader reviews them first.
 */
export async function submitPrayer(input: {
  content: string;
  /** Who should pray: Prayer Wall + Intercessors, Intercessors only, or Pastor only. */
  shareWith: PrayerShareWith;
  anonymous?: boolean;
  /** Visitors only. */
  name?: string;
  /** Hidden field; must stay empty. */
  website?: string;
  asMember: boolean;
}): Promise<PrayerSubmitStatus> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const body: Record<string, unknown> = {
    content: input.content,
    share_with: input.shareWith,
    is_confidential: input.shareWith !== 'wall',
  };
  if (input.website) body.website = input.website;
  if (input.asMember) {
    const token = await getAccessToken();
    if (!token) throw new PrayerSubmitError('Please sign in again to continue.');
    headers.Authorization = `Bearer ${token}`;
    body.is_anonymous = !!input.anonymous;
  } else {
    body.member_name = input.name || '';
  }

  let res: Response;
  try {
    res = await fetch('/api/prayer', { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new PrayerSubmitError('No connection. Your prayer is still here, so you can try again.');
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; status?: string; message?: string } | null;
  if (!res.ok || !data?.ok) {
    throw new PrayerSubmitError(data?.message || 'We couldn’t send your prayer request. Please try again.');
  }
  const status = data.status;
  return status === 'Published' || status === 'Confidential' ? status : 'Vetting';
}
