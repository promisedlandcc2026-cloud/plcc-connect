import { isDmChannel, isHuddleChannelLive, type CommunityChatChannel, type HuddleChannelStatus } from './communityChatTypes';

export type ChatSection = 'prayers' | 'ministries' | 'messages' | 'direct' | 'live';
export const CHAT_SECTIONS: readonly ChatSection[] = ['prayers', 'ministries', 'messages', 'direct', 'live'];

export function parseChatSection(value: string | null): ChatSection {
  if (value === 'prayer') return 'prayers';
  if (value === 'huddles') return 'live';
  if (value === 'dms') return 'direct';
  return CHAT_SECTIONS.includes(value as ChatSection) ? value as ChatSection : 'prayers';
}

/** Match Ka Link's named gatherings; keep all rooms in Messages even if unclassified. */
export function isPrayerRoom(room: Pick<CommunityChatChannel, 'name'>): boolean {
  const name = room.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return /\b(prayer|prayers|intercessor|intercessors)\b/.test(name) ||
    ['morning glory', 'lunch hour', 'lunch hour prayer', 'lunchtime prayer', 'midnight watch', 'midnight prayer', 'upper room', 'the upper room'].includes(name);
}

export function chatSectionRooms(channels: CommunityChatChannel[], live: Record<string, HuddleChannelStatus>, section: ChatSection): CommunityChatChannel[] {
  const groups = channels.filter((room) => !isDmChannel(room));
  if (section === 'prayers') return groups.filter(isPrayerRoom);
  if (section === 'ministries') return groups.filter((room) => !isPrayerRoom(room));
  if (section === 'messages') return groups;
  if (section === 'live') return groups.filter((room) => isHuddleChannelLive(live[room.id]));
  return [];
}
