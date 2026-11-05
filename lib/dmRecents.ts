/**
 * Vault excludes DMs from the channels list — keep recent DMs opened on this device.
 */

import type { ChatDirectoryMember } from './communityChatTypes';

const STORAGE_KEY = 'awc.chat.dmRecents.v1';
const MAX_RECENTS = 30;

export type DmRecent = {
  channelId: string;
  partnerId: string;
  partnerName: string;
  avatarUrl: string | null;
  updatedAt: number;
};

function readAll(): DmRecent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is DmRecent =>
          Boolean(
            row &&
              typeof row === 'object' &&
              typeof (row as DmRecent).channelId === 'string' &&
              typeof (row as DmRecent).partnerId === 'string' &&
              typeof (row as DmRecent).partnerName === 'string'
          )
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeAll(rows: DmRecent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore quota */
  }
}

export function listDmRecents(): DmRecent[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function rememberDmRecent(input: {
  channelId: string;
  partner: ChatDirectoryMember;
}): void {
  const next: DmRecent = {
    channelId: input.channelId,
    partnerId: input.partner.id,
    partnerName: input.partner.name,
    avatarUrl: input.partner.avatarUrl,
    updatedAt: Date.now(),
  };
  const rest = readAll().filter((r) => r.channelId !== next.channelId);
  writeAll([next, ...rest]);
}

export function dmDisplayName(channelId: string, fallback = 'Direct message'): string {
  const hit = readAll().find((r) => r.channelId === channelId);
  return hit?.partnerName || fallback;
}
