/**
 * Intercessors prayer list — bridge parsing, meeting days, notification link.
 * Run: node --test scripts/test-intercessors.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  parsePrayerMarkCommand,
  lastMeetingStart,
  nextMeetingDay,
  parseIntercessorsQuery,
  parseVaultIntercessorsAccess,
  parseVaultIntercessorsList,
} from '../api/_utils/intercessorsSanitize.js';
import { buildVaultIntercessorsUrl, VAULT_INTERCESSORS_PATH } from '../api/_utils/vaultOrigin.js';
import { resolveNotificationDestination } from '../api/_utils/notificationSanitize.js';
import { sanitizeChatMessage } from '../api/_utils/communityChatSanitize.js';

const d = (y, m, day) => new Date(y, m - 1, day, 10, 0, 0);
const ymd = (x) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;

describe('meeting days (Tuesday and Friday)', () => {
  it('Monday: since Friday, next meeting Tuesday', () => {
    assert.equal(ymd(lastMeetingStart(d(2026, 10, 19))), '2026-10-16');
    assert.equal(ymd(nextMeetingDay(d(2026, 10, 19))), '2026-10-20');
  });
  it('Tuesday (meeting day): since the Friday before, meeting is today', () => {
    assert.equal(ymd(lastMeetingStart(d(2026, 10, 20))), '2026-10-16');
    assert.equal(ymd(nextMeetingDay(d(2026, 10, 20))), '2026-10-20');
  });
  it('Wednesday: since Tuesday, next meeting Friday', () => {
    assert.equal(ymd(lastMeetingStart(d(2026, 10, 21))), '2026-10-20');
    assert.equal(ymd(nextMeetingDay(d(2026, 10, 21))), '2026-10-23');
  });
  it('Friday (meeting day): since Tuesday', () => {
    assert.equal(ymd(lastMeetingStart(d(2026, 10, 23))), '2026-10-20');
  });
  it('starts at midnight', () => {
    const s = lastMeetingStart(d(2026, 10, 19));
    assert.equal(s.getHours() + s.getMinutes(), 0);
  });
});

describe('query and responses', () => {
  it('access query', () => {
    assert.deepEqual(parseIntercessorsQuery({ action: 'access' }), { ok: true, action: 'access' });
  });
  it('accepts ISO dates, refuses junk', () => {
    assert.equal(parseIntercessorsQuery({ from: '2026-10-16T04:00:00.000Z', to: '2026-10-19' }).ok, true);
    assert.equal(parseIntercessorsQuery({ from: "2026-10-16'; drop" }).ok, false);
    assert.equal(parseIntercessorsQuery({ to: 'x'.repeat(50) }).ok, false);
  });
  it('builds the fixed Vault URL', () => {
    assert.equal(buildVaultIntercessorsUrl('https://v.example/', { action: 'access' }), `https://v.example${VAULT_INTERCESSORS_PATH}&action=access`);
    assert.match(buildVaultIntercessorsUrl('https://v.example', { from: '2026-10-16T00:00:00Z' }), /&from=2026-10-16T00%3A00%3A00Z$/);
  });
  it('access response is booleans only', () => {
    assert.deepEqual(parseVaultIntercessorsAccess({ allowed: 'yes', setUp: true, ministryName: 'PLCC Intercessors Ministry' }), {
      ok: true, allowed: false, setUp: true, ministryName: 'PLCC Intercessors Ministry', roomId: null, canLead: false,
    });
    assert.equal(parseVaultIntercessorsAccess({ roomId: '44444444-4444-4444-8444-444444444444' }).roomId, '44444444-4444-4444-8444-444444444444');
    assert.equal(parseVaultIntercessorsAccess({ roomId: '../admin' }).roomId, null);
  });
  it('list keeps only the printout fields', () => {
    const out = parseVaultIntercessorsList({
      ministryName: 'PLCC Intercessors Ministry',
      items: [
        { id: 'p1', name: 'Grace', category: 'Healing', content: 'Pray for my mom', createdAt: '2026-10-17T12:00:00Z', onWall: true, user_id: 'secret' },
        { id: '', content: 'no id' },
        null,
      ],
    });
    assert.equal(out.items.length, 1);
    assert.deepEqual(Object.keys(out.items[0]).sort(), ['answeredAt', 'category', 'content', 'createdAt', 'id', 'name', 'onWall', 'prayedAt', 'prayedBy', 'privateToIntercessors']);
    assert.equal(parseVaultIntercessorsList({}), null);
  });
});

describe('Prayer Watch marks', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('accepts Prayed and Answered with true/false', () => {
    assert.deepEqual(parsePrayerMarkCommand({ action: 'prayed', id, value: true }), { action: 'prayed', id, value: true });
    assert.deepEqual(parsePrayerMarkCommand({ action: 'answered', id, value: false }), { action: 'answered', id, value: false });
  });
  it('refuses anything else', () => {
    assert.equal(parsePrayerMarkCommand({ action: 'delete', id, value: true }), null);
    assert.equal(parsePrayerMarkCommand({ action: 'prayed', id: 'x', value: true }), null);
    assert.equal(parsePrayerMarkCommand({ action: 'prayed', id, value: 1 }), null);
    assert.equal(parsePrayerMarkCommand({ action: 'prayed', id, value: true, status: 'Published' }), null);
    assert.equal(parsePrayerMarkCommand(null), null);
    assert.deepEqual(parsePrayerMarkCommand({ action: 'join-room' }), { action: 'join-room' });
    assert.deepEqual(parsePrayerMarkCommand({ action: 'remove', id }), { action: 'remove', id });
    assert.equal(parsePrayerMarkCommand({ action: 'remove', id: 'nope' }), null);
    assert.equal(parsePrayerMarkCommand({ action: 'remove', id, value: true }), null);
    assert.equal(parsePrayerMarkCommand({ action: 'join-room', userId: 'someone' }), null);
  });
  it('list items carry marks; praise view parses', () => {
    const out = parseVaultIntercessorsList({ view: 'answered', canLead: true, items: [{ id, name: 'Grace', content: 'x', prayedAt: '2026-10-20T19:00:00Z', prayedBy: 'Olivia', answeredAt: '2026-10-21T10:00:00Z' }] });
    assert.equal(out.view, 'answered');
    assert.equal(out.canLead, true);
    assert.equal(out.items[0].prayedBy, 'Olivia');
    assert.equal(out.items[0].answeredAt, '2026-10-21T10:00:00Z');
  });
  it('answered view URL', () => {
    assert.match(buildVaultIntercessorsUrl('https://v.example', { view: 'answered' }), /&view=answered$/);
    assert.deepEqual(parseIntercessorsQuery({ view: 'answered' }), { ok: true, view: 'answered' });
  });
});

describe('wiring', () => {
  it('intercessor notifications open the prayer list', () => {
    assert.equal(resolveNotificationDestination('prayer', null, '/intercessors')?.path, '/intercessors');
    assert.equal(resolveNotificationDestination('prayer', null, '/community/prayer-watch')?.path, '/intercessors');
    assert.equal(resolveNotificationDestination('prayer', null, '/community/prayer-wall')?.path, '/');
  });
  it('prayer requests in the Intercessors chat show as PLCC Prayer Requests', () => {
    const base = { id: '33333333-3333-4333-8333-333333333333', channel_id: '44444444-4444-4444-8444-444444444444', content: 'New prayer request from Grace', created_at: '2026-10-19T12:00:00Z', user_id: null };
    assert.equal(sanitizeChatMessage({ ...base, user_name: 'PLCC Prayer Requests' })?.author?.name, 'PLCC Prayer Requests');
    assert.equal(sanitizeChatMessage({ ...base, user_name: 'Pastor (fake)' })?.author?.name, 'Vault AI');
  });

  it('rides on the vault-news function (Hobby budget)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.equal(vercel.rewrites.find((r) => r.source === '/api/intercessors')?.destination, '/api/vault-news?bridge=intercessors');
    const fns = readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js'));
    assert.ok(fns.length <= 15);
  });
  it('Prayer Watch page has the huddle and the requests', () => {
    const src = readFileSync(new URL('../pages/IntercessorsPrayerWatch.tsx', import.meta.url), 'utf8');
    assert.match(src, /ConnectVoiceHuddle[\s\S]*embedded/);
    assert.match(src, /Praise reports/);
    assert.match(src, /Prayer meeting today/);
    assert.match(src, /window\.print\(\)/);
    assert.match(src, /audioOnly/);
    assert.match(src, /Yes, remove/);
  });

  it('the form offers all three choices', () => {
    const src = readFileSync(new URL('../components/PrayerModule.tsx', import.meta.url), 'utf8');
    assert.match(src, /Prayer Wall \+ Intercessors/);
    assert.match(src, /Intercessors only/);
    assert.match(src, /Pastor only/);
  });
});
