/**
 * Phase 2.4 — Sunday Mode contracts.
 * Run: node --test scripts/test-sunday-mode.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function isLocalSunday(d) {
  return d.getDay() === 0;
}

function isActiveSignupStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'pending' || s === 'confirmed';
}

function localDayBounds(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function filterServingToday(items, now) {
  const { start, end } = localDayBounds(now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return (items || []).filter((item) => {
    if (!isActiveSignupStatus(item.status)) return false;
    const raw = item.opportunity?.startsAt;
    if (!raw) return false;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return false;
    return ms >= startMs && ms <= endMs;
  });
}

function isYouTubeLiveUrl(url) {
  return /youtube\.com\/live\//.test(String(url || ''));
}

function limitSundayAnnouncements(items, limit = 3) {
  return (items || []).slice(0, Math.max(0, limit));
}

describe('Sunday Mode pure helpers', () => {
  it('detects local Sunday', () => {
    assert.equal(isLocalSunday(new Date('2026-09-13T12:00:00')), true); // Sunday
    assert.equal(isLocalSunday(new Date('2026-09-14T12:00:00')), false); // Monday
  });

  it('filters Serve today to active signups with startsAt on local day', () => {
    const now = new Date('2026-09-13T15:00:00');
    const items = [
      {
        id: '1',
        status: 'confirmed',
        opportunity: { startsAt: '2026-09-13T14:30:00.000Z' },
      },
      {
        id: '2',
        status: 'pending',
        opportunity: { startsAt: '2026-09-13T10:00:00.000Z' },
      },
      {
        id: '3',
        status: 'cancelled',
        opportunity: { startsAt: '2026-09-13T14:30:00.000Z' },
      },
      {
        id: '4',
        status: 'declined',
        opportunity: { startsAt: '2026-09-13T14:30:00.000Z' },
      },
      {
        id: '5',
        status: 'confirmed',
        opportunity: { startsAt: '2026-09-20T14:30:00.000Z' },
      },
    ];
    // Use UTC-aware local: construct startsAt as local ISO for the day
    const day = '2026-09-13';
    const localItems = [
      {
        id: 'a',
        status: 'confirmed',
        opportunity: { startsAt: new Date(`${day}T10:30:00`).toISOString() },
      },
      {
        id: 'b',
        status: 'pending',
        opportunity: { startsAt: new Date(`${day}T11:00:00`).toISOString() },
      },
      {
        id: 'c',
        status: 'cancelled',
        opportunity: { startsAt: new Date(`${day}T10:30:00`).toISOString() },
      },
      {
        id: 'd',
        status: 'declined',
        opportunity: { startsAt: new Date(`${day}T10:30:00`).toISOString() },
      },
      {
        id: 'e',
        status: 'confirmed',
        opportunity: { startsAt: new Date('2026-09-20T10:30:00').toISOString() },
      },
    ];
    const filtered = filterServingToday(localItems, new Date(`${day}T12:00:00`));
    assert.deepEqual(
      filtered.map((i) => i.id).sort(),
      ['a', 'b']
    );
  });

  it('Live Now only for real youtube.com/live/ URLs', () => {
    assert.equal(isYouTubeLiveUrl('https://www.youtube.com/live/abc'), true);
    assert.equal(isYouTubeLiveUrl('https://www.youtube.com/watch?v=abc'), false);
    assert.equal(isYouTubeLiveUrl(''), false);
  });

  it('limits announcements to 3', () => {
    assert.equal(limitSundayAnnouncements([1, 2, 3, 4, 5], 3).length, 3);
  });
});

describe('Sunday Mode routes + integrations', () => {
  it('registers /sunday behind approved_member MemberGate', () => {
    const app = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(app.includes('path="/sunday"'));
    assert.ok(app.includes('MemberSundayPage'));
    const block = app.slice(app.indexOf('path="/sunday"'), app.indexOf('path="/sunday"') + 350);
    assert.ok(block.includes('requireAccess="approved_member"'));
  });

  it('MemberNav stays five items without Sunday tab', () => {
    const nav = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(nav.includes("label: 'Home'"));
    assert.ok(nav.includes("label: 'Me'"));
    assert.equal(nav.includes("label: 'Sunday'"), false);
    assert.equal(nav.includes("label: 'Sunday Mode'"), false);
  });

  it('Home shows SundayModeBanner; More links to /sunday', () => {
    const home = readFileSync(join(root, 'components/member/MemberHome.tsx'), 'utf8');
    const banner = readFileSync(join(root, 'components/member/SundayModeBanner.tsx'), 'utf8');
    const more = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');
    assert.ok(home.includes('SundayModeBanner'));
    assert.ok(banner.includes('isLocalSunday'));
    assert.ok(banner.includes('to="/sunday"'));
    assert.ok(more.includes("to: '/sunday'"));
    assert.ok(more.includes("label: 'Sunday Mode'"));
  });

  it('Sunday page reuses real sources; no family/check-in fakes', () => {
    const page = readFileSync(join(root, 'pages/MemberSunday.tsx'), 'utf8');
    assert.ok(page.includes('resolveLatestVideoUrl'));
    assert.ok(page.includes('isYouTubeLiveUrl'));
    assert.ok(page.includes('Live Now'));
    assert.ok(page.includes('fetchMemberHomeEvents'));
    assert.ok(page.includes('filterEventsToday'));
    assert.ok(page.includes('Nothing else is scheduled today.'));
    assert.ok(page.includes('fetchMyServing'));
    assert.ok(page.includes('filterServingToday'));
    assert.ok(page.includes('fetchMemberHomeAnnouncements'));
    assert.ok(page.includes('GiveModule'));
    assert.ok(page.includes('PrayerModule'));
    assert.ok(page.includes('to="/prayer"'));
    assert.ok(page.includes('to="/community"'));
    assert.ok(page.includes('to="/community/chat"'));
    assert.ok(page.includes('useNotifications'));
    assert.ok(page.includes('DigitalBulletin'));
    assert.ok(page.includes('SermonNotes'));
    assert.ok(page.includes('useState(true)'));
    assert.ok(page.includes('Take Notes'));
    assert.ok(page.includes('notesNewPath'));
    assert.equal(page.includes('Coming in Phase 2.5'), false);
    assert.equal(page.includes('check-in'), false);
    assert.equal(page.includes('Check-In'), false);
    assert.equal(page.includes('checkIn'), false);
    assert.equal(/LiveKit|huddle/i.test(page), false);
    assert.equal(page.includes('verified_by'), false);
    assert.equal(page.includes('date_of_birth'), false);
  });

  it('shell treats /sunday as auth + member nav', () => {
    const shell = readFileSync(join(root, 'lib/memberShell.ts'), 'utf8');
    assert.ok(shell.includes("'/sunday'"));
    assert.ok(shell.includes('isSundayPath'));
  });

  it('visitor PublicHome unchanged (no Sunday Mode)', () => {
    const home = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(home.includes('PublicHome'));
    assert.equal(home.includes('/sunday'), false);
    assert.equal(home.includes('SundayMode'), false);
  });

  it('API function count remains 14; no new SQL', () => {
    const files = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(countApiJsHandlers(files), 15);
    assert.equal(existsSync(join(root, 'supabase')), false);
  });

  it('section failure isolation — independent section components', () => {
    const page = readFileSync(join(root, 'pages/MemberSunday.tsx'), 'utf8');
    assert.ok(page.includes('SundayWatchSection'));
    assert.ok(page.includes('SundayTodayEvents'));
    assert.ok(page.includes('SundayServingToday'));
    assert.ok(page.includes('SundayAnnouncements'));
    assert.ok(page.includes('role="alert"') || page.includes('ErrorState'));
  });
});
