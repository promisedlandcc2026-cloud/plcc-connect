/**
 * Warn, then block, an unruly member (Nov 19 2026) — Tribes calls, chat, posts, comments.
 * Run: node scripts/test-member-conduct.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('Tribes warn / block', () => {
  it('same sheet as Ka Link: warn first, Block unlocks after', () => {
    assert.equal(read('components/conduct/ConductSheet.tsx'), readFileSync(join(root, '../plcc-chat/components/conduct/ConductSheet.tsx'), 'utf8'));
    assert.match(read('components/conduct/ConductSheet.tsx'), /disabled=\{busy !== null \|\| !status\?\.warnedAt\}/);
  });

  it('calls: moderators get a warn button on people; members see the notice in every layout', () => {
    const call = read('components/community/ConnectVoiceHuddle.tsx');
    assert.match(call, /topic === HUDDLE_CONDUCT_TOPIC/);
    assert.ok(call.indexOf('topic === HUDDLE_CONDUCT_TOPIC') < call.indexOf("if (!mountedRef.current || !participant) return;"));
    assert.equal((call.match(/\{conductOverlays\}/g) || []).length, 3);
    assert.equal((call.match(/\{warnButton\(tile,/g) || []).length, 2);
  });

  it('chat, posts and comments offer Warn to moderators', () => {
    assert.match(read('pages/CommunityChatRoom.tsx'), /place: 'chat'/);
    assert.match(read('components/tribes/TribesPostActions.tsx'), /Warn or block author/);
    assert.match(read('components/tribes/TribesPostActions.tsx'), /Warn or block \{post\.author\.name\}/);
    assert.match(read('components/CommunityCommentsSection.tsx'), /comment-warn-block/);
  });

  it('bridges pass member-conduct through and explain a block', () => {
    const chat = read('api/_community/community-chat.js');
    assert.match(chat, /resource === 'member-conduct'/);
    assert.equal((chat.match(/'member_blocked'/g) || []).length >= 2, true);
    assert.match(read('api/_community/community-posts.js'), /member_blocked/);
    assert.match(read('api/_community/community-comments.js'), /member_blocked/);
    assert.match(read('lib/communityPostClient.ts'), /codeFromBody === 'member_blocked'/);
  });
});
