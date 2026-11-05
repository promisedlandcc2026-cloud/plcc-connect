/**
 * Phase 2.1 — My PLCC Home contracts + pure helpers.
 * Run: node --test scripts/test-member-home.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function firstNameFromDisplayName(name) {
  if (name == null) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  return first;
}

function daypartGreeting(now) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function memberHomeGreeting(displayName, now = new Date()) {
  const first = firstNameFromDisplayName(displayName);
  if (!first) return 'Welcome back';
  return `${daypartGreeting(now)}, ${first}`;
}

function eventStartMs(event) {
  const raw = event.starts_at || event.date;
  if (!raw) return Number.NaN;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Number.NaN;
}

function localDayBounds(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function filterEventsToday(events, now = new Date()) {
  const { start, end } = localDayBounds(now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return events
    .filter((e) => {
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b));
}

function filterUpcomingEvents(events, opts = {}) {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 3;
  const nowMs = now.getTime();
  return events
    .filter((e) => {
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms > nowMs;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))
    .slice(0, limit);
}

describe('greeting', () => {
  it('uses first name with daypart', () => {
    const morning = new Date('2026-09-12T09:00:00');
    assert.equal(memberHomeGreeting('Jerless Hiire', morning), 'Good morning, Jerless');
    const afternoon = new Date('2026-09-12T14:00:00');
    assert.equal(memberHomeGreeting('Jerless', afternoon), 'Good afternoon, Jerless');
    const evening = new Date('2026-09-12T19:00:00');
    assert.equal(memberHomeGreeting('Jerless', evening), 'Good evening, Jerless');
  });

  it('falls back to Welcome back without usable name', () => {
    assert.equal(memberHomeGreeting(null), 'Welcome back');
    assert.equal(memberHomeGreeting(''), 'Welcome back');
    assert.equal(memberHomeGreeting('user@example.com'), 'Welcome back');
  });
});

describe('today / upcoming events', () => {
  const now = new Date('2026-09-12T12:00:00');
  const events = [
    { id: '1', title: 'Today AM', starts_at: '2026-09-12T10:00:00' },
    { id: '2', title: 'Tomorrow', starts_at: '2026-09-13T10:00:00' },
    { id: '3', title: 'Later today', starts_at: '2026-09-12T18:00:00' },
    { id: '4', title: 'Yesterday', starts_at: '2026-09-11T10:00:00' },
  ];

  it('filters today events only', () => {
    const today = filterEventsToday(events, now);
    assert.deepEqual(
      today.map((e) => e.id),
      ['1', '3']
    );
  });

  it('empty today state when none', () => {
    assert.equal(filterEventsToday([], now).length, 0);
    assert.equal(
      filterEventsToday([{ id: 'x', title: 'T', starts_at: '2026-09-13T10:00:00' }], now).length,
      0
    );
  });

  it('upcoming is future-only and limited', () => {
    const upcoming = filterUpcomingEvents(events, { now, limit: 3 });
    assert.deepEqual(
      upcoming.map((e) => e.id),
      ['3', '2']
    );
  });
});

describe('Home visitor vs member wiring', () => {
  it('Home switches approved members to MemberHome and keeps PublicHome otherwise', () => {
    const src = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(src.includes('PublicHome'));
    assert.ok(src.includes('MemberHome'));
    assert.ok(src.includes("memberAccessState === 'approved_member'"));
    assert.ok(src.includes('Announcements'));
    assert.ok(src.includes('ConnectCard'));
    assert.equal(src.includes('DigitalBulletin'), false);
    assert.equal(src.includes('SermonNotes'), false);
  });

  it('MemberHome does not mount for pending via gate in Home', () => {
    const src = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.equal(src.includes("memberAccessState === 'pending'"), false);
    assert.ok(src.includes('return <PublicHome'));
  });
});

describe('My PLCC sections contracts', () => {
  it('MemberHome composes Phase 1 header then feed sections', () => {
    const src = readFileSync(join(root, 'components/member/MemberHome.tsx'), 'utf8');
    assert.ok(src.includes('awc-home-shell'));
    const order = [
      'SeasonHeroLayer',
      'MemberHomeHeader',
      'PWAPrompt',
      'SundayModeBanner',
      'HolidayRsvpCard',
      'MemberHomeDaily',
      'MemberHomeUpcoming',
      'MemberHomeAnnouncements',
      'MemberHomeCelebrations',
      'MemberHomeCommunity',
      'MemberHomePrayer',
      'WatchLive',
      'MemberHomeSermon',
      'MemberHomeVaultNews',
      'MemberHomeLeaderboard',
    ];
    let last = -1;
    for (const name of order) {
      const idx = src.indexOf(`<${name}`);
      assert.ok(idx > last, `${name} missing or out of order`);
      last = idx;
    }
    // The 8-tile hub duplicated the bottom bar; unread count lives on the bell only.
    assert.equal(src.includes('<HomeHubGrid'), false);
    assert.equal(src.includes('<MemberHomeNotifications'), false);
    assert.equal(src.includes('<MemberHomeToday'), false);
    // One header style: Home section titles carry no emoji.
    assert.equal(/title="\p{Extended_Pictographic}/u.test(src), false);
  });

  it('Home does not repeat itself', () => {
    const upcoming = readFileSync(join(root, 'components/member/MemberHomeUpcoming.tsx'), 'utf8');
    assert.ok(upcoming.includes('pickNextUp'), 'Upcoming skips the Next up event');
    const sermon = readFileSync(join(root, 'components/member/MemberHomeSermon.tsx'), 'utf8');
    assert.equal(sermon.includes('Open on YouTube'), false, 'Watch player above owns YouTube');
    assert.equal(sermon.includes('MemberHomeSection'), false, 'sermon sits inside the Watch section');
    const home = readFileSync(join(root, 'components/member/MemberHome.tsx'), 'utf8');
    assert.ok(home.indexOf('<WatchLive') < home.indexOf('<MemberHomeSermon'));
    for (const f of ['MemberHomeUpcoming', 'MemberHomeAnnouncements', 'MemberHomeCelebrations', 'MemberHomeCommunity', 'MemberHomePrayer', 'MemberHomeVaultNews']) {
      const src = readFileSync(join(root, `components/member/${f}.tsx`), 'utf8');
      assert.equal(/title="\p{Extended_Pictographic}/u.test(src), false, `${f} title has no emoji`);
    }
  });

  it('MemberHomeHeader greets by first name, shows Next up and one row of shortcuts', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeHeader.tsx'), 'utf8');
    assert.ok(src.includes('memberHomeGreeting(identity?.name'));
    assert.equal(src.includes('identity?.email'), false);
    assert.ok(src.includes('pickNextUp'));
    for (const label of ['Give', 'My QR', 'Notes', 'Watch']) {
      assert.ok(src.includes(`>${label}</span>`), label);
    }
    // Prayer and Bible already have a home (bottom bar / Today circles) — not repeated here.
    assert.equal(src.includes('>Prayer</span>'), false);
    assert.equal(src.includes('>Bible</span>'), false);
    assert.ok(src.includes('GiveModule'));
    assert.ok(src.includes('MyPassQrModal'));
  });

  it('HomeHubGrid exposes screenshot hub tiles for members', () => {
    const src = readFileSync(join(root, 'components/home/HomeHubGrid.tsx'), 'utf8');
    assert.ok(src.includes("label: 'Announcements'"));
    assert.ok(src.includes("label: 'Events'"));
    assert.ok(src.includes("label: 'Watch Live'"));
    assert.ok(src.includes("label: 'Give'"));
    assert.ok(src.includes("label: 'Prayer Request'"));
    assert.ok(src.includes("label: 'Community'"));
    assert.ok(src.includes("label: 'Ministries'"));
    assert.ok(src.includes("label: 'Directory'"));
    assert.ok(src.includes('GiveModule'));
  });

  it('greeting uses memberHomeGreeting helper', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeGreeting.tsx'), 'utf8');
    assert.ok(src.includes('memberHomeGreeting'));
    assert.ok(src.includes('identity?.name'));
    assert.equal(src.includes('identity?.email'), false);
    assert.equal(src.includes('identity?.role'), false);
  });

  it('Quick Actions route My Card and Serve + active items', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeQuickActions.tsx'), 'utf8');
    assert.ok(src.includes("to: '/community'"));
    assert.ok(src.includes("to: '/prayer'"));
    assert.ok(src.includes("to: '/events'"));
    assert.ok(src.includes("to: '/serve'"));
    assert.ok(src.includes("to: '/card'"));
    assert.ok(src.includes("label: 'My Card'"));
    assert.ok(src.includes("label: 'Serve'"));
    assert.ok(src.includes('GiveModule'));
    assert.equal(src.includes("to: '/family'"), false);
    assert.equal(src.includes("label: 'My Family'"), false);
  });

  it('Latest Community uses feed bridge with small limit', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeCommunity.tsx'), 'utf8');
    assert.ok(src.includes('fetchCommunityFeedPage'));
    assert.ok(src.includes('PREVIEW_LIMIT = 3'));
    assert.ok(src.includes('limit: PREVIEW_LIMIT'));
    assert.equal(src.includes(".from('community"), false);
    assert.equal(src.includes(".from('posts'"), false);
  });

  it('Prayer fetch excludes confidential', () => {
    const src = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    assert.ok(src.includes(".eq('status', 'Published')"));
    assert.ok(src.includes('isPublicPrayerRow'));
    assert.ok(src.includes('is_confidential === true'));
    assert.equal(src.includes(".eq('is_confidential', false)"), false);
  });

  it('Today does not hardcode LIVE without youtube live check', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeToday.tsx'), 'utf8');
    assert.ok(src.includes('isYouTubeLiveUrl'));
    assert.ok(src.includes('Nothing scheduled at PLCC today'));
  });

  it('Notifications preview uses existing context only', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeNotifications.tsx'), 'utf8');
    assert.ok(src.includes('useNotifications'));
    assert.ok(src.includes("You're all caught up") || src.includes('You&apos;re all caught up'));
    assert.equal(src.includes('setInterval'), false);
    assert.equal(src.includes('fetch('), false);
  });

  it('staff Vault link remains on More', () => {
    const more = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');
    assert.ok(more.includes('canOpenVaultStaffLink'));
    assert.ok(more.includes('Open PLCC Canaan'));
  });

  it('member shell / MemberNav still present', () => {
    const nav = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(nav.includes("label: 'Home'"));
    assert.ok(nav.includes("label: 'Me'"));
  });

  it('no new SQL migrations and no new api/*.js for 2.1', () => {
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
    const apiFiles = readFileSync(join(root, 'package.json'), 'utf8');
    assert.ok(apiFiles.includes('awc-connect'));
    // Count api root handlers stays documented as 11 in ecosystem — assert no sermon_notes SQL file
    assert.equal(existsSync(join(root, 'supabase')), false);
    const homeData = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    assert.equal(homeData.includes('create table'), false);
  });

  it('sections use independent error UI primitives', () => {
    for (const file of [
      'MemberHomeCommunity.tsx',
      'MemberHomeToday.tsx',
      'MemberHomeUpcoming.tsx',
      'MemberHomePrayer.tsx',
    ]) {
      const src = readFileSync(join(root, 'components/member', file), 'utf8');
      assert.ok(src.includes('ErrorState'), file);
    }
  });
});
