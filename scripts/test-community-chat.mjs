/**
 * Phase — Community chat sanitize / URL tests (channels, DMs, huddle start/end).
 * Run: node --test scripts/test-community-chat.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAT_MESSAGE_MAX_CHARS,
  parseChatMessagesListQuery,
  parseChatUnreadQuery,
  parseDirectoryQuery,
  parseHuddleEndCommand,
  parseHuddleStatusQuery,
  parseHuddleTokenCommand,
  parseMarkChatReadCommand,
  parseOpenDmCommand,
  parseSendChatMessageCommand,
  parseVaultChatChannelsResponse,
  parseVaultChatMessageMutationResponse,
  parseVaultChatMessagesResponse,
  parseVaultChatUnreadResponse,
  parseVaultDirectoryResponse,
  parseVaultDmChannelResponse,
  parseVaultHuddleEndResponse,
  parseVaultHuddleStatusesResponse,
  parseVaultHuddleTokenResponse,
  sanitizeChatChannel,
  sanitizeChatMessage,
  validateConnectChatContent,
} from '../api/_utils/communityChatSanitize.js';
import {
  buildVaultCommunityChatChannelsUrl,
  buildVaultCommunityChatDmChannelUrl,
  buildVaultCommunityChatHuddleStatusesUrl,
  buildVaultCommunityChatMarkReadUrl,
  buildVaultCommunityChatMentorsUrl,
  buildVaultCommunityChatMessagesUrl,
  buildVaultCommunityChatUnreadUrl,
  buildVaultCommunityChatVoiceEndUrl,
  buildVaultCommunityChatVoiceTokenUrl,
  VAULT_COMMUNITY_CHAT_CHANNELS_PATH,
  VAULT_COMMUNITY_CHAT_DM_CHANNEL_PATH,
  VAULT_COMMUNITY_CHAT_HUDDLE_STATUSES_PATH,
  VAULT_COMMUNITY_CHAT_MENTORS_PATH,
  VAULT_COMMUNITY_CHAT_MESSAGES_PATH,
  VAULT_COMMUNITY_CHAT_VOICE_END_PATH,
  VAULT_COMMUNITY_CHAT_VOICE_TOKEN_PATH,
} from '../api/_utils/vaultOrigin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CHANNEL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MESSAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('buildVaultCommunityChat URLs', () => {
  it('uses fixed chat paths only', () => {
    const channels = buildVaultCommunityChatChannelsUrl('https://vault.example.com/');
    assert.ok(channels.includes(VAULT_COMMUNITY_CHAT_CHANNELS_PATH));

    const list = buildVaultCommunityChatMessagesUrl('https://vault.example.com/', CHANNEL_ID);
    assert.ok(list.includes(VAULT_COMMUNITY_CHAT_MESSAGES_PATH));
    assert.ok(list.includes(`channelId=${CHANNEL_ID}`));

    const post = buildVaultCommunityChatMessagesUrl('https://vault.example.com/');
    assert.equal(post, `https://vault.example.com${VAULT_COMMUNITY_CHAT_MESSAGES_PATH}`);

    assert.ok(buildVaultCommunityChatUnreadUrl('https://vault.example.com').includes('unread-count'));
    assert.ok(buildVaultCommunityChatMarkReadUrl('https://vault.example.com').includes('mark-read'));

    const mentors = buildVaultCommunityChatMentorsUrl('https://vault.example.com/');
    assert.ok(mentors.includes(VAULT_COMMUNITY_CHAT_MENTORS_PATH));
    assert.equal(mentors.includes('email'), false);

    const dm = buildVaultCommunityChatDmChannelUrl('https://vault.example.com/', USER_ID);
    assert.ok(dm.includes(VAULT_COMMUNITY_CHAT_DM_CHANNEL_PATH));
    assert.ok(dm.includes(`partnerId=${USER_ID}`));
  });

  it('builds huddle status + voice-token + voice-end URLs (no mod)', () => {
    const statuses = buildVaultCommunityChatHuddleStatusesUrl(
      'https://vault.example.com/',
      `${CHANNEL_ID},${MESSAGE_ID}`
    );
    assert.ok(statuses.includes(VAULT_COMMUNITY_CHAT_HUDDLE_STATUSES_PATH));
    assert.ok(statuses.includes('channelIds='));
    assert.equal(statuses.includes('voice-huddle-mod'), false);

    const tokenUrl = buildVaultCommunityChatVoiceTokenUrl('https://vault.example.com/');
    assert.equal(tokenUrl, `https://vault.example.com${VAULT_COMMUNITY_CHAT_VOICE_TOKEN_PATH}`);
    assert.ok(tokenUrl.includes('voice-token'));
    assert.equal(tokenUrl.includes('LIVEKIT'), false);

    const endUrl = buildVaultCommunityChatVoiceEndUrl('https://vault.example.com/');
    assert.equal(endUrl, `https://vault.example.com${VAULT_COMMUNITY_CHAT_VOICE_END_PATH}`);
    assert.ok(endUrl.includes('voice-huddle-end'));
    assert.equal(endUrl.includes('voice-huddle-mod'), false);
  });
});

describe('query + command parsers', () => {
  it('accepts channelId list query only', () => {
    assert.deepEqual(parseChatMessagesListQuery({ channelId: CHANNEL_ID }), {
      ok: true,
      channelId: CHANNEL_ID,
    });
    assert.equal(parseChatMessagesListQuery({}).ok, false);
    assert.equal(parseChatMessagesListQuery({ channelId: CHANNEL_ID, x: '1' }).ok, false);
  });

  it('rejects unread query extras', () => {
    assert.equal(parseChatUnreadQuery({}).ok, true);
    assert.equal(parseChatUnreadQuery({ since: 'x' }).ok, false);
  });

  it('maps send + mark-read commands', () => {
    assert.deepEqual(
      parseSendChatMessageCommand({ channelId: CHANNEL_ID, content: '  Hello  ' }),
      { ok: true, channelId: CHANNEL_ID, content: 'Hello' }
    );
    assert.equal(
      parseSendChatMessageCommand({
        channelId: CHANNEL_ID,
        content: 'hi',
        user_id: USER_ID,
      }).ok,
      false
    );
    assert.equal(
      parseSendChatMessageCommand({
        channelId: CHANNEL_ID,
        content: 'x'.repeat(CHAT_MESSAGE_MAX_CHARS + 1),
      }).ok,
      false
    );
    assert.deepEqual(parseMarkChatReadCommand({ channelId: CHANNEL_ID }), {
      ok: true,
      channelId: CHANNEL_ID,
    });
  });

  it('validates content', () => {
    assert.equal(validateConnectChatContent('  ok  ').ok, true);
    assert.equal(validateConnectChatContent('   ').ok, false);
  });
});

describe('sanitize channel + message', () => {
  it('keeps presentation fields and allows DMs without secrets', () => {
    const open = sanitizeChatChannel({
      id: CHANNEL_ID,
      name: 'General',
      description: 'Hello',
      visibility: 'open',
      type: 'public',
      participants: [USER_ID],
      created_by: USER_ID,
      email: 'x@y.com',
    });
    assert.ok(open);
    assert.equal(open.name, 'General');
    assert.equal('participants' in open, false);
    assert.equal('created_by' in open, false);
    assert.equal(open.ministryId, null);

    const dm = sanitizeChatChannel({
      id: CHANNEL_ID,
      name: 'DM_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      visibility: 'dm',
      participants: [USER_ID],
      email: 'x@y.com',
    });
    assert.ok(dm);
    assert.equal(dm.visibility, 'dm');
    assert.equal(dm.name, 'Direct message');
    assert.equal('email' in dm, false);
    assert.equal('participants' in dm, false);
  });

  it('sanitizes messages and strips attachments/reactions', () => {
    const msg = sanitizeChatMessage({
      id: MESSAGE_ID,
      channel_id: CHANNEL_ID,
      content: 'Peace',
      created_at: '2026-09-01T12:00:00.000Z',
      user_id: USER_ID,
      user_name: 'Jane',
      avatar_url: 'https://cdn.example.com/a.png',
      reactions: [{ user_id: USER_ID, emoji: '❤️' }],
      attachments: [{ storage_path: 'secret' }],
      email: 'secret@example.com',
    });
    assert.ok(msg);
    assert.equal(msg.content, 'Peace');
    assert.equal(msg.author.id, USER_ID);
    assert.equal('reactions' in msg, false);
    assert.equal('attachments' in msg, false);
    assert.equal('email' in msg, false);
  });

  it('maps list and mutation responses', () => {
    const list = parseVaultChatMessagesResponse([
      {
        id: MESSAGE_ID,
        channel_id: CHANNEL_ID,
        content: 'Hi',
        created_at: '2026-09-01T12:00:00.000Z',
        user_id: USER_ID,
        user_name: 'Jane',
      },
      { id: 'bad' },
    ]);
    assert.equal(list.ok, true);
    assert.equal(list.messages.length, 1);
    assert.equal(list.skipped, 1);

    const channels = parseVaultChatChannelsResponse([
      { id: CHANNEL_ID, name: 'General', visibility: 'open' },
      {
        id: MESSAGE_ID,
        name: 'DM_x',
        visibility: 'dm',
      },
    ]);
    assert.equal(channels.ok, true);
    assert.equal(channels.channels.length, 2);
    assert.equal(channels.channels[1].visibility, 'dm');
    assert.equal(channels.channels[1].name, 'Direct message');

    const created = parseVaultChatMessageMutationResponse({
      id: MESSAGE_ID,
      channel_id: CHANNEL_ID,
      content: 'New',
      created_at: '2026-09-01T12:00:00.000Z',
      user_id: USER_ID,
      user_name: 'Jane',
    });
    assert.equal(created.ok, true);
    assert.equal(created.message.content, 'New');

    const unread = parseVaultChatUnreadResponse({
      count: 3,
      byChannel: { [CHANNEL_ID]: 2, notauuid: 9 },
    });
    assert.equal(unread.ok, true);
    assert.equal(unread.count, 3);
    assert.equal(unread.byChannel[CHANNEL_ID], 2);
    assert.equal(unread.byChannel.notauuid, undefined);
  });
});

describe('huddle status + token sanitize', () => {
  it('parses huddle-status query and rejects junk', () => {
    assert.deepEqual(parseHuddleStatusQuery({ channelIds: CHANNEL_ID }), {
      ok: true,
      channelIds: [CHANNEL_ID],
    });
    assert.equal(parseHuddleStatusQuery({}).ok, false);
    assert.equal(parseHuddleStatusQuery({ channelIds: CHANNEL_ID, x: '1' }).ok, false);
    assert.equal(parseHuddleStatusQuery({ channelIds: 'not-uuid' }).ok, false);
  });

  it('parses huddle-token command (channelId only)', () => {
    assert.deepEqual(parseHuddleTokenCommand({ channelId: CHANNEL_ID }), {
      ok: true,
      channelId: CHANNEL_ID,
    });
    assert.equal(
      parseHuddleTokenCommand({ channelId: CHANNEL_ID, role: 'admin' }).ok,
      false
    );
  });

  it('treats live + participantCount > 0 as the visible LIVE mark', () => {
    const types = readFileSync(join(root, 'lib/communityChatTypes.ts'), 'utf8');
    assert.match(types, /isHuddleChannelLive/);
    assert.match(types, /s\.live/);
    assert.match(types, /participantCount/);
  });

  it('maps status live/participantCount and drops extras', () => {
    const parsed = parseVaultHuddleStatusesResponse(
      {
        ok: true,
        configured: true,
        byChannel: {
          [CHANNEL_ID]: {
            active: true,
            participantCount: 4,
            roomName: 'secret-room',
            hostId: USER_ID,
          },
          'not-a-uuid': { active: true, participantCount: 9 },
        },
        warning: 'ignore',
      },
      [CHANNEL_ID, MESSAGE_ID]
    );
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.byChannel[CHANNEL_ID], {
      live: true,
      participantCount: 4,
    });
    assert.deepEqual(parsed.byChannel[MESSAGE_ID], {
      live: false,
      participantCount: 0,
    });
    assert.equal(parsed.byChannel['not-a-uuid'], undefined);
    assert.equal('roomName' in parsed.byChannel[CHANNEL_ID], false);
    assert.equal('hostId' in parsed.byChannel[CHANNEL_ID], false);
  });

  it('sanitizes voice-token payload and rejects secrets / bad URLs', () => {
    const ok = parseVaultHuddleTokenResponse({
      ok: true,
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      url: 'wss://livekit.example.com',
      roomName: 'voice_' + CHANNEL_ID,
      expiresIn: 3600,
      canModerate: false,
      channelCanModerate: true,
      hostId: USER_ID,
      coHostIds: [USER_ID],
      channelId: CHANNEL_ID,
      channelName: 'General',
      LIVEKIT_API_SECRET: 'must-not-leak',
    });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.token, {
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      url: 'wss://livekit.example.com/',
      roomName: 'voice_' + CHANNEL_ID,
      expiresIn: 3600,
      canModerate: false,
      channelId: CHANNEL_ID,
      channelName: 'General',
    });
    assert.equal('hostId' in ok.token, false);
    assert.equal('LIVEKIT_API_SECRET' in ok.token, false);
    assert.equal('channelCanModerate' in ok.token, false);

    assert.equal(
      parseVaultHuddleTokenResponse({
        ok: true,
        token: 't',
        url: 'http://insecure.example',
        roomName: 'r',
        channelId: CHANNEL_ID,
      }).ok,
      false
    );
    assert.equal(
      parseVaultHuddleTokenResponse({
        ok: true,
        token: 'LIVEKIT_API_SECRET=abc',
        url: 'wss://livekit.example.com',
        roomName: 'r',
        channelId: CHANNEL_ID,
      }).ok,
      false
    );
  });
});

describe('Connect huddle bridge + UI wiring', () => {
  it('allows huddle resources including end; never forwards mod', () => {
    const bridge = readFileSync(join(root, 'api/_community/community-chat.js'), 'utf8');
    const origin = readFileSync(join(root, 'api/_utils/vaultOrigin.js'), 'utf8');
    assert.ok(bridge.includes("'huddle-status'"));
    assert.ok(bridge.includes("'huddle-token'"));
    assert.ok(bridge.includes("'huddle-end'"));
    assert.ok(bridge.includes("'directory'"));
    assert.ok(bridge.includes("'dm'"));
    assert.ok(bridge.includes('buildVaultCommunityChatHuddleStatusesUrl'));
    assert.ok(bridge.includes('buildVaultCommunityChatVoiceTokenUrl'));
    assert.ok(bridge.includes('buildVaultCommunityChatVoiceEndUrl'));
    assert.ok(bridge.includes('buildVaultCommunityChatMentorsUrl'));
    assert.ok(bridge.includes('buildVaultCommunityChatDmChannelUrl'));
    assert.ok(origin.includes('voice-huddle-end'));
    assert.equal(bridge.includes('voice-huddle-mod'), false);
    assert.equal(origin.includes('voice-huddle-mod'), false);
    assert.ok(bridge.includes('parseVaultHuddleTokenResponse'));
    assert.equal(bridge.includes('LIVEKIT_API_SECRET'), false);
  });

  it('wires New chat, Start huddle, Join, and End on UI', () => {
    const list = readFileSync(join(root, 'pages/CommunityChat.tsx'), 'utf8');
    const room = readFileSync(join(root, 'pages/CommunityChatRoom.tsx'), 'utf8');
    const overlay = readFileSync(
      join(root, 'components/community/ConnectVoiceHuddle.tsx'),
      'utf8'
    );
    assert.ok(list.includes('useHuddleLive'));
    assert.ok(list.includes('HuddleLiveBadge'));
    assert.ok(list.includes('New chat') || list.includes('New'));
    assert.ok(list.includes('searchChatDirectory'));
    assert.ok(list.includes('openDirectMessage'));
    const huddleCtx = readFileSync(join(root, 'context/HuddleLiveContext.tsx'), 'utf8');
    assert.ok(huddleCtx.includes('fetchHuddleStatuses'));
    assert.ok(huddleCtx.includes('10_000'));
    const nav = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(nav.includes('showHuddleLive'));
    assert.ok(nav.includes('HuddleLiveDot'));
    const badge = readFileSync(join(root, 'components/huddle/HuddleLiveDot.tsx'), 'utf8');
    assert.ok(badge.includes('bg-emerald-500'));
    assert.equal(list.includes('bg-red-600'), false);
    assert.ok(room.includes('Join huddle'));
    assert.ok(room.includes('bg-emerald-500'));
    assert.ok(room.includes('Start huddle'));
    assert.ok(room.includes('ConnectVoiceHuddle'));
    assert.ok(overlay.includes('livekit-client'));
    assert.ok(overlay.includes('Enable sound'));
    assert.ok(overlay.includes('fetchHuddleToken'));
    assert.ok(overlay.includes('endHuddle'));
    assert.ok(overlay.includes('End huddle for everyone'));
    assert.ok(overlay.includes('Hands raised'));
    assert.ok(overlay.includes('HuddlePeoplePanel'));
    assert.ok(overlay.includes('HuddleMobileTabs'));
    assert.ok(overlay.includes('HuddleChatPanel'));
    assert.equal(overlay.includes('voice-huddle-mod'), false);
  });
});

describe('directory + dm + huddle-end parsers', () => {
  it('requires bounded directory q', () => {
    assert.equal(parseDirectoryQuery({ q: 'Jo' }).ok, true);
    assert.deepEqual(parseDirectoryQuery({ q: '@Sheevon' }), {
      ok: true,
      q: 'Sheevon',
    });
    assert.equal(parseDirectoryQuery({ q: '@' }).ok, false);
    assert.equal(parseDirectoryQuery({}).ok, false);
    assert.equal(parseDirectoryQuery({ q: '' }).ok, false);
    assert.equal(parseDirectoryQuery({ q: 'a'.repeat(50) }).ok, false);
  });

  it('filters mentors and strips role/email', () => {
    const parsed = parseVaultDirectoryResponse(
      [
        { id: USER_ID, name: 'Jane Doe', role: 'PASTOR', email: 'a@b.com', avatar_url: null },
        { id: CHANNEL_ID, name: 'John Smith', role: 'MEMBER' },
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          name: 'Sheevon Example',
          role: 'MEMBER',
        },
        { id: 'bad', name: 'Nope' },
      ],
      '@Sheevon'
    );
    assert.equal(parsed.ok, true);
    assert.equal(parsed.members.length, 1);
    assert.equal(parsed.members[0].name, 'Sheevon Example');

    const jane = parseVaultDirectoryResponse(
      [
        { id: USER_ID, name: 'Jane Doe', role: 'PASTOR', email: 'a@b.com', avatar_url: null },
        { id: CHANNEL_ID, name: 'John Smith', role: 'MEMBER' },
      ],
      'jan'
    );
    assert.equal(jane.ok, true);
    assert.equal(jane.members.length, 1);
    assert.equal(jane.members[0].name, 'Jane Doe');
    assert.equal('role' in jane.members[0], false);
    assert.equal('email' in jane.members[0], false);
  });

  it('maps dm open + huddle end', () => {
    assert.deepEqual(parseOpenDmCommand({ partnerId: USER_ID }), {
      ok: true,
      partnerId: USER_ID,
    });
    assert.equal(parseOpenDmCommand({ partnerId: 'x' }).ok, false);

    const dm = parseVaultDmChannelResponse(
      {
        id: CHANNEL_ID,
        name: 'DM_x',
        visibility: 'dm',
        type: 'private',
      },
      USER_ID
    );
    assert.equal(dm.ok, true);
    assert.equal(dm.channel.visibility, 'dm');
    assert.equal(dm.partnerId, USER_ID);

    assert.deepEqual(parseHuddleEndCommand({ channelId: CHANNEL_ID }), {
      ok: true,
      channelId: CHANNEL_ID,
    });
    assert.equal(parseVaultHuddleEndResponse({ ok: true, ended: true }).ok, true);
    assert.equal(parseVaultHuddleEndResponse({ ok: false }).ok, false);
  });
});

describe('Live Huddle start rule (members join, leaders/moderators start)', () => {
  it('passes Vault huddle_start_forbidden through as huddle_not_started on every start path', () => {
    const bridge = readFileSync(join(root, 'api/_community/community-chat.js'), 'utf8');
    assert.ok(bridge.includes("body.code === 'huddle_start_forbidden'"));
    assert.ok(bridge.includes("code: 'huddle_not_started'"));
    // huddle-token, huddle-line, daily backup, and outage fallback
    const uses = bridge.split('isHuddleStartForbidden(').length - 1;
    assert.ok(uses >= 5, `expected helper + 4 call sites, got ${uses}`);
  });
  it('client shows the not-started wording instead of "no access"', () => {
    const client = readFileSync(join(root, 'lib/communityChatClient.ts'), 'utf8');
    assert.ok(client.includes("bodyCode === 'huddle_not_started'"));
    assert.ok(client.includes("hasn't started yet"));
  });
});
