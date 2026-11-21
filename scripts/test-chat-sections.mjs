import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['lib/chatSections.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const sections = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const room = (id, name, overrides = {}) => ({ id, name, visibility: 'open', type: 'public', ministryId: null, description: null, ...overrides });
const rooms = [room('a', 'Morning Glory'), room('b', 'Youth Ministry', { ministryId: 'youth' }), room('c', 'Leadership Briefing'), room('d', 'DM_private', { visibility: 'dm' }), room('e', 'Prayer Altar Administrators')];
const live = { a: { live: true, participantCount: 2 }, b: { live: true, participantCount: 0 }, d: { live: true, participantCount: 1 } };
const ids = (tab) => sections.chatSectionRooms(rooms, live, tab).map((r) => r.id);

test('five tabs keep prayer, ministry, shared messages, direct messages and live rooms distinct', () => {
  assert.deepEqual(sections.CHAT_SECTIONS, ['prayers', 'ministries', 'messages', 'direct', 'live']);
  assert.deepEqual(ids('prayers'), ['a', 'e']);
  assert.deepEqual(ids('ministries'), ['b', 'c']);
  assert.deepEqual(ids('messages'), ['a', 'b', 'c', 'e']);
  assert.deepEqual(ids('direct'), []);
  assert.deepEqual(ids('live'), ['a']);
});

test('tab URLs handle known Ka Link aliases and safely default', () => {
  assert.equal(sections.parseChatSection('prayer'), 'prayers');
  assert.equal(sections.parseChatSection('huddles'), 'live');
  assert.equal(sections.parseChatSection('dms'), 'direct');
  assert.equal(sections.parseChatSection('unknown'), 'prayers');
});
