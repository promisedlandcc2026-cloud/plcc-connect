/**
 * "Today at PLCC" story circles — which ones show, and whether each has
 * something new since the member last opened it (gold ring).
 * Seen state is a per-device convenience only (localStorage).
 */
import type { VaultNewsItem } from './vaultNews';

export type StoryId = 'verse' | 'holiday' | 'news' | 'prayer' | 'praise';

const SEEN_KEY = 'awc_story_seen_v1';

export function readSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function markSeen(id: StoryId, stamp: string): Record<string, string> {
  const next = { ...readSeen(), [id]: stamp };
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: rings just stay gold */
  }
  return next;
}

export function isUnseen(seen: Record<string, string>, id: StoryId, stamp: string): boolean {
  return Boolean(stamp) && seen[id] !== stamp;
}

/** Church news & sympathy go in Vault News; celebrations are Praise. Ops notices stay out. */
export function splitVaultNews(items: VaultNewsItem[]): { news: VaultNewsItem[]; praise: VaultNewsItem[] } {
  const usable = (items || []).filter((n) => n && n.kind !== 'database');
  return {
    news: usable.filter((n) => n.kind !== 'celebration').slice(0, 5),
    praise: usable.filter((n) => n.kind === 'celebration').slice(0, 5),
  };
}

/** Stamp that changes when the newest item changes. */
export function stampFor(items: Array<{ id: string }>): string {
  return items.length ? String(items[0].id) : '';
}

/** WhatsApp share link for inviting family. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
