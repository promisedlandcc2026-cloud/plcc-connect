/**
 * Tribes — Scripture posts.
 *
 * A Scripture post is a Community post whose content carries a verse block
 * from the church Bible reader (see lib/verseShare.ts: "📖 Ref · KJV / “…” /
 * https://<site>/bible?t=…&b=…&c=…&v=…"). The verse wording was loaded from
 * the website's Bible API when the post was made, and parseVerseMessage only
 * accepts links that point at the church Bible reader, so nothing here can
 * invent a verse.
 */
import { parseVerseMessage, type SharedVerse } from './verseShare';

export type FeedView = 'all' | 'scripture';

export const FEED_VIEW_PARAM = 'view';

export function feedViewFromParams(params: URLSearchParams): FeedView {
  return params.get(FEED_VIEW_PARAM) === 'scripture' ? 'scripture' : 'all';
}

export type ScriptureParts = SharedVerse & { note: string };

/** The verse in a post, or null when the post isn't a Scripture post. */
export function scriptureOf(content: string | null | undefined): ScriptureParts | null {
  return parseVerseMessage(content);
}

export function isScripturePost(post: { content?: string | null }): boolean {
  return scriptureOf(post.content) !== null;
}

/** Keeps the feed order (pinned first) and only filters. */
export function filterFeedPosts<T extends { content?: string | null }>(posts: T[], view: FeedView): T[] {
  return view === 'scripture' ? posts.filter(isScripturePost) : posts;
}

/**
 * Ka Link's verse share screen path for a verse link from the church Bible
 * reader: /share?kind=verse&t=…&b=…&c=…&v=… (Ka Link fetches the wording
 * itself). Null if the link isn't a usable Bible reader link.
 */
export function kaLinkVerseSharePath(verseUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(verseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.pathname !== '/bible') return null;
  const t = u.searchParams.get('t') || '';
  const b = (u.searchParams.get('b') || '').toUpperCase();
  const c = u.searchParams.get('c') || '';
  const v = u.searchParams.get('v') || '';
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(t) || !/^[0-9A-Z]{3}$/.test(b) || !/^\d{1,3}$/.test(c)) return null;
  if (v && !/^\d{1,3}(-\d{1,3})?$/.test(v)) return null;
  const q = new URLSearchParams({ kind: 'verse', t, b, c });
  if (v) q.set('v', v);
  return `/share?${q.toString()}`;
}
