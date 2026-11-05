/**
 * Chat moves to PLCC Chat (one chat for the whole church).
 * Off until VITE_CHAT_MOVED=true is set in Vercel (then redeploy); while off, Connect keeps its own Chat.
 */
import { isSupabaseConfigured, supabase } from './supabase';

export const CHAT_MOVED = import.meta.env.VITE_CHAT_MOVED === 'true';
export const AWC_CHAT_ORIGIN = String(import.meta.env.VITE_CHAT_ORIGIN || 'https://plcc-chat.vercel.app').replace(/\/+$/, '');

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** PLCC Chat URL for this room (or the chat list), signed in when we can. */
export async function awcChatUrl(channelId?: string | null, search = ''): Promise<string> {
  const room = channelId && ID_RE.test(channelId) ? `/community/chat/${channelId}` : '/community/chat';
  // Keep a huddle link's one-tap Join / Start card (?huddle=join|start).
  const intent = new URLSearchParams(search).get('huddle');
  const next = room !== '/community/chat' && (intent === 'join' || intent === 'start') ? `${room}?huddle=${intent}` : room;
  return awcChatSignedInUrl(next);
}

/** "Share to PLCC Chat" for an event or Serve need: PLCC Chat's share screen, signed in. */
export async function awcChatShareUrl(kind: 'event' | 'serve', id: string): Promise<string> {
  return awcChatSignedInUrl(`/share?${new URLSearchParams({ kind, id }).toString()}`);
}

/** Any PLCC Chat path, opened with the one sign-on handoff when we can. */
export async function awcChatSignedInUrl(next: string): Promise<string> {
  const plain = `${AWC_CHAT_ORIGIN}${next}`;
  if (!isSupabaseConfigured) return plain;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return plain;
    const res = await fetch('/api/sso', {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    const tokenHash = body?.ok ? String(body.tokenHash || '') : '';
    if (!tokenHash) return plain;
    return `${AWC_CHAT_ORIGIN}/auth/sso#${new URLSearchParams({ th: tokenHash, next }).toString()}`;
  } catch {
    return plain;
  }
}
