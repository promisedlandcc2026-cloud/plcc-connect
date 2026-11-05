import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('anniversary titles follow the member’s choice', async () => {
  const b = await import('../lib/blessings.ts');
  assert.equal(b.anniversaryTitle('wedding'), 'Wedding anniversary');
  assert.equal(b.anniversaryTitle('other', 'Salvation'), 'Salvation anniversary');
  assert.equal(b.anniversaryTitle('other', 'Baptism Anniversary'), 'Baptism Anniversary');
  assert.equal(b.anniversaryTitle('other', '  '), 'Anniversary');
  assert.equal(b.anniversaryTitle(null), 'Anniversary');
});

test('blessing starter messages per occasion', async () => {
  const b = await import('../lib/blessings.ts');
  assert.match(b.blessingTemplate('birthday', 'Grace Okafor'), /^Happy birthday, Grace!/);
  assert.match(b.blessingTemplate('wedding', 'Brother Sam Lee'), /^Happy anniversary, Brother Sam!/);
  assert.match(b.blessingTemplate('other', 'Joy', { otherLabel: 'Salvation' }), /^Happy salvation anniversary, Joy!/);
  assert.match(b.blessingTemplate('other', 'Joy'), /^Happy special day, Joy!/);
  assert.match(b.blessingTemplate('birthday', 'Joy', { daysAway: 3 }), /a little early/);
  assert.doesNotMatch(b.blessingTemplate('birthday', 'Joy', { daysAway: 0 }), /early/);
  assert.equal(b.defaultOccasion({ occasion: 'birthday', anniversaryKind: null }), 'birthday');
  assert.equal(b.defaultOccasion({ occasion: 'anniversary', anniversaryKind: 'other' }), 'other');
  assert.equal(b.defaultOccasion({ occasion: 'anniversary', anniversaryKind: null }), 'wedding');
  assert.equal(b.whenLabel(0), 'Today');
  assert.equal(b.whenLabel(1), 'Tomorrow');
  assert.match(b.whenLabel(3, new Date(2026, 9, 25)), /Oct 28/);
});

test('celebration rows are sanitized', async () => {
  const { sanitizeCelebration } = await import('../lib/blessings.ts');
  const ok = sanitizeCelebration({ directoryId: 'm1', partnerUserId: 'u1', displayName: 'Grace', occasion: 'anniversary',
    anniversaryKind: 'other', anniversaryLabel: 'Baptism', monthDay: '10-27', daysAway: 2 });
  assert.equal(ok.anniversaryKind, 'other');
  assert.equal(sanitizeCelebration({ directoryId: 'm1', displayName: 'x', occasion: 'birthday', monthDay: '01-01', daysAway: 0 }), null, 'needs partner');
  assert.equal(sanitizeCelebration({ directoryId: 'm1', partnerUserId: 'u', displayName: 'x', occasion: 'party', monthDay: '01-01', daysAway: 0 }), null);
  assert.equal(sanitizeCelebration({ directoryId: 'm1', partnerUserId: 'u', displayName: 'x', occasion: 'birthday', anniversaryKind: 'wedding', monthDay: '01-01', daysAway: 0 }).anniversaryKind, null);
});

test('screens are wired: profile picker, Home card, Directory, SQL', () => {
  const profile = read('pages/MemberProfile.tsx');
  assert.match(profile, /<AnniversaryKindPicker/);
  assert.match(profile, /updateMyAnniversaryKind\(/);
  const picker = read('components/member/AnniversaryKindPicker.tsx');
  assert.match(picker, /💍 Wedding/);
  assert.match(picker, /✨ Other/);
  const sheet = read('components/member/BlessingSheet.tsx');
  for (const label of ['🎂 Birthday', '💍 Wedding', '✨ Other']) assert.ok(sheet.includes(label), label);
  assert.match(sheet, /openDirectMessage\(celebration\.partnerUserId\)/);
  assert.match(read('components/member/MemberHome.tsx'), /<MemberHomeCelebrations \/>/);
  const dir = read('pages/MemberDirectory.tsx');
  assert.match(dir, /anniversaryTitle\(kind\?\.kind, kind\?\.label\)/);
  assert.match(dir, /<BlessingSheet/);
  const sql = read('docs/supabase/connect_celebrations.sql');
  for (const fn of ['get_my_anniversary_kind', 'update_my_anniversary_kind', 'list_member_celebrations', 'list_member_anniversary_kinds']) {
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(`), fn);
  }
  assert.match(sql, /member_directory_is_eligible\(m\.id\)/, 'same privacy as the directory');
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.(list_member_directory|search_member_directory|update_my_member_profile|get_my_member_profile)\b/);
});

test('Pastor greetings show in the inbox with a Celebration label and open Home', async () => {
  const { sanitizeNotification } = await import('../api/_utils/notificationSanitize.js');
  const n = sanitizeNotification({
    id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    type: 'celebration',
    title: 'Happy birthday, Grace! 🎂',
    body: 'Your PLCC family thanks God for you today.',
    created_at: '2026-04-28T11:05:00Z',
    link: '/',
  });
  assert.equal(n.typeLabel, 'Celebration');
  assert.equal(n.destination.path, '/');
  assert.match(read('pages/MemberNotifications.tsx'), /type === 'celebration'/);
});
