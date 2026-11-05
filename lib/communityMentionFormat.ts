/**
 * Client-side Community mention helpers (mirrors Vault feed mention tokens).
 */

export type MentionCandidate = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export const FEED_MENTION_TOKEN_RE =
  /@\[([^\]]{1,80})\]\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export const MENTION_QUERY_MIN_CHARS = 1;
export const MENTION_QUERY_MAX_CHARS = 40;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildFeedMentionToken(displayName: string, userId: string): string | null {
  const name =
    String(displayName || 'Member')
      .trim()
      .replace(/[\[\]]/g, '')
      .slice(0, 80) || 'Member';
  const id = String(userId || '').trim();
  if (!UUID_RE.test(id)) return null;
  return `@[${name}](mention:${id})`;
}

/** @[Name](mention:uuid) → @Name. Never HTML. */
export function formatFeedContentForDisplay(content: string): string {
  return String(content || '').replace(FEED_MENTION_TOKEN_RE, (_full, name: string) => {
    const n = String(name || '').trim() || 'Member';
    return `@${n}`;
  });
}

export function extractFeedMentionIds(content: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(FEED_MENTION_TOKEN_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(content || ''))) !== null) {
    const id = String(m[2] || '').toLowerCase();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Detect active @query at caret. Does not trigger inside completed tokens or email-like prefixes.
 */
export function findActiveMentionQuery(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && /[\w\]]/.test(before[at - 1] || '')) return null;
  const fragment = before.slice(at + 1);
  if (fragment.includes('\n') || fragment.includes('](')) return null;
  if (fragment.length > MENTION_QUERY_MAX_CHARS) return null;
  if (fragment.includes('[')) return null;
  return { start: at, query: fragment };
}

export function isValidMentionCandidateId(id: string): boolean {
  return UUID_RE.test(String(id || '').trim());
}
