/**
 * Tribes calls have the same moderator tools as Ka Link (Nov 20 2026): every call starts
 * with mics locked, so mods must be able to Unlock mics / Let them speak from Tribes too.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHuddleModerateCommand } from '../api/_utils/communityChatSanitize.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const CH = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('Tribes moderator tools', () => {
  it('bridge forwards moderator actions to the right Canaan route', () => {
    assert.equal(parseHuddleModerateCommand({ channelId: CH, action: 'mic-unlock' }).subResource, 'voice-huddle-stage');
    assert.equal(parseHuddleModerateCommand({ channelId: CH, action: 'allow-mic', targetIdentity: CH }).subResource, 'voice-huddle-stage');
    assert.equal(parseHuddleModerateCommand({ channelId: CH, action: 'unmute', targetIdentity: CH }).subResource, 'voice-participant-mute');
    assert.equal(parseHuddleModerateCommand({ channelId: CH, action: 'mic-unlock', targetIdentity: CH }), null);
    assert.match(read('api/_community/community-chat.js'), /resource === 'huddle-moderate'/);
    assert.match(read('api/_utils/vaultOrigin.js'), /'voice-huddle-stage'/);
  });
  it('same moderator component as Ka Link; call screen shows the bar and person menu', () => {
    const mine = read('components/huddle/HuddleModeratorTools.tsx');
    const kalink = readFileSync(join(root, '../plcc-chat/components/huddle/HuddleModeratorTools.tsx'), 'utf8');
    assert.equal(mine.replace(/communityChatClient|huddleModerate/g, 'X'), kalink.replace(/communityChatClient|huddleModerate/g, 'X'));
    const call = read('components/community/ConnectVoiceHuddle.tsx');
    assert.equal((call.match(/<ModeratorRoomBar/g) || []).length, 2);
    assert.match(call, /<PersonActionsSheet/);
    assert.match(call, /RoomEvent\.RoomMetadataChanged/);
  });
});
