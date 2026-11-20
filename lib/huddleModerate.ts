/**
 * Ka Link moderator actions from Tribes (Nov 20 2026) — same as Ka Link. Canaan checks
 * the caller really is a moderator of this call.
 */
import { supabase } from './supabase';

export type HuddleModerateAction =
  | 'mute'
  | 'unmute'
  | 'lower-hand'
  | 'lower-all-hands'
  | 'mic-lock'
  | 'mic-unlock'
  | 'allow-mic'
  | 'revoke-mic'
  | 'reader-add'
  | 'reader-remove'
  | 'remove'
  | 'block';

export class HuddleModerateError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function moderateHuddle(
  channelId: string,
  action: HuddleModerateAction,
  targetIdentity?: string
): Promise<{ micLock: boolean; readerIds: string[]; asked: boolean }> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new HuddleModerateError('Please sign in again.', 401);
  const res = await fetch('/api/community-chat?resource=huddle-moderate', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(targetIdentity ? { channelId, action, targetIdentity } : { channelId, action }),
  });
  const b = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || b?.ok !== true) {
    throw new HuddleModerateError(typeof b?.message === 'string' && b.message ? b.message : 'That did not work. Please try again.', res.status);
  }
  return {
    micLock: b.micLock === true,
    readerIds: Array.isArray(b.readerIds) ? b.readerIds.filter((id: unknown) => typeof id === 'string') : [],
    /** Unmute: LiveKit won't switch someone's mic on, so they were asked to (Nov 20 2026). */
    asked: b.asked === true,
  };
}
