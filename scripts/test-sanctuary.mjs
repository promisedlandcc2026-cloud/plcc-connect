/**
 * Sanctuary redesign — ticket countdown, Sunday live switch, season chip,
 * order of service, stories, attendance plans, wallet card, dock, motion.
 * Run: node --test scripts/test-sanctuary.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

async function load(entry) {
  const out = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, format: 'esm', platform: 'neutral' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

const thu = new Date(2026, 9, 15, 13, 38); // Thu Oct 15 2026, local

describe('Next-up ticket countdown', () => {
  it('reads days + hours, then hours + minutes, then minutes, then Now', async () => {
    const s = await load('lib/sanctuary.ts');
    const sun = new Date(2026, 9, 18, 10, 30);
    const c = s.countdownTo(sun, thu);
    assert.equal(c.big, '2d');
    assert.equal(c.small, '20 hrs');
    assert.match(c.spoken, /2 days and 20 hours to go/);
    assert.ok(c.fraction > 0.5 && c.fraction < 0.7);
    assert.equal(s.countdownTo(sun, new Date(2026, 9, 18, 5, 0)).big, '5h');
    assert.equal(s.countdownTo(sun, new Date(2026, 9, 18, 10, 0)).big, '30m');
    const now = s.countdownTo(sun, new Date(2026, 9, 18, 10, 31));
    assert.equal(now.big, 'Now');
    assert.equal(now.started, true);
    assert.equal(now.fraction, 1);
  });

  it('plan keys match the attendance_plans check', async () => {
    const s = await load('lib/sanctuary.ts');
    const ev = { kind: 'event', happeningNow: false, event: { id: 'A1B2C3D4-E5F6-4789-A012-202611221400', title: 'X', starts_at: new Date(2026, 10, 22, 14).toISOString() } };
    assert.equal(s.planKeyFor(ev, thu), 'event:a1b2c3d4-e5f6-4789-a012-202611221400');
    const fallback = { kind: 'fallback', title: 'Sunday Celebration Service', when: '' };
    assert.equal(s.planKeyFor(fallback, thu), 'sunday:2026-10-18');
    const sql = read('docs/supabase/connect_attendance_plans.sql');
    const re = /plan_key ~ '\^\(event:\[0-9a-f-\]\{36\}\|sunday:\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\)\$'/;
    assert.match(sql, re);
  });
});

describe('Sunday live switch', () => {
  it('is live from 15 min before the Sunday service until it ends, or when the stream is live', async () => {
    const s = await load('lib/sanctuary.ts');
    const start = new Date(2026, 9, 18, 10, 30);
    assert.equal(s.isSundayLive({ now: new Date(2026, 9, 18, 10, 10), serviceStartsAt: start, streamLive: false }), false);
    assert.equal(s.isSundayLive({ now: new Date(2026, 9, 18, 10, 16), serviceStartsAt: start, streamLive: false }), true);
    assert.equal(s.isSundayLive({ now: new Date(2026, 9, 18, 12, 29), serviceStartsAt: start, streamLive: false }), true);
    assert.equal(s.isSundayLive({ now: new Date(2026, 9, 18, 12, 31), serviceStartsAt: start, streamLive: false }), false);
    assert.equal(s.isSundayLive({ now: thu, serviceStartsAt: start, streamLive: false }), false);
    assert.equal(s.isSundayLive({ now: thu, serviceStartsAt: null, streamLive: true }), true);
  });

  it('header only treats a live stream as Sunday-live on Sunday', () => {
    const h = read('components/member/MemberHomeHeader.tsx');
    assert.match(h, /streamLive: Boolean\(liveUrl\) && now\.getDay\(\) === 0/);
    assert.match(h, /<SundayLiveHome/);
    assert.match(h, /<NextUpTicket/);
    assert.match(h, /<TodayStories/);
    assert.match(read('components/member/MemberHome.tsx'), /data-mode=\{live \? 'live' : 'weekday'\}/);
  });
});

describe('season chip', () => {
  it('names the season and counts down to the featured holiday', async () => {
    const s = await load('lib/sanctuary.ts');
    assert.equal(
      s.seasonChipLabel({ season: 'fall', holidayTitle: 'Thanksgiving Dinner', holidayDate: '2026-11-22', now: thu }),
      'Fall at PLCC · Thanksgiving Dinner in 38 days'
    );
    assert.equal(s.seasonChipLabel({ season: 'winter', now: thu }), 'Winter at PLCC');
    assert.match(s.seasonChipLabel({ season: 'fall', holidayTitle: 'X', holidayDate: '2026-10-16', now: thu }), /X tomorrow$/);
  });
});

describe('order of service', () => {
  it('times steps from the run of show and finds the current one', async () => {
    const s = await load('lib/sanctuary.ts');
    const start = new Date(2026, 9, 18, 10, 30);
    const steps = s.buildServiceSteps(
      [
        { id: '1', title: 'Opening Prayer & Worship', start_time: '10:30 AM', duration_minutes: 25 },
        { id: '2', title: 'Welcome', start_time: null, duration_minutes: 15 },
        { id: '3', title: 'The Spoken Word', start_time: '11:25', duration_minutes: 50 },
        { id: '4', title: '  ', start_time: null },
      ],
      start
    );
    assert.equal(steps.length, 3);
    assert.equal(steps[1].timeLabel, '10:55 AM');
    assert.equal(steps[2].timeLabel, '11:25 AM');
    assert.equal(s.currentStepIndex(steps, new Date(2026, 9, 18, 11, 30)), 2);
    assert.equal(s.currentStepIndex(steps, new Date(2026, 9, 18, 10, 0)), -1);
    assert.equal(s.parseStepTime('7:30 PM', start).getHours(), 19);
    assert.equal(s.parseStepTime('15 mins', start), null);
  });

  it('reads only member-safe run-of-show columns and falls back without times', () => {
    const src = read('lib/orderOfServiceClient.ts');
    assert.match(src, /from\('event_run_of_show'\)/);
    assert.match(src, /select\('id, title, start_time, duration_minutes, sort_order'\)/);
    assert.equal(/owner|notes/.test(src.split('select(')[1].split(')')[0]), false);
    assert.match(src, /timeLabel: null/);
  });
});

describe('Today stories', () => {
  it('splits Canaan News: celebrations are Praise, ops notices hidden', async () => {
    const t = await load('lib/todayStories.ts');
    const items = [
      { id: 'a', kind: 'church', title: 'A', body: '' },
      { id: 'b', kind: 'celebration', title: 'B', body: '' },
      { id: 'c', kind: 'database', title: 'C', body: '' },
      { id: 'd', kind: 'sympathy', title: 'D', body: '' },
    ];
    const split = t.splitVaultNews(items);
    assert.deepEqual(split.news.map((n) => n.id), ['a', 'd']);
    assert.deepEqual(split.praise.map((n) => n.id), ['b']);
    assert.equal(t.isUnseen({ news: 'a' }, 'news', 'a'), false);
    assert.equal(t.isUnseen({ news: 'a' }, 'news', 'z'), true);
    assert.match(t.whatsAppShareUrl('Hi & bye'), /^https:\/\/wa\.me\/\?text=Hi%20%26%20bye$/);
  });

  it('story viewer is a real dialog with close, keys, pause and reduce-motion', () => {
    const v = read('components/sanctuary/StoryViewer.tsx');
    assert.match(v, /role="dialog"/);
    assert.match(v, /aria-modal="true"/);
    assert.match(v, /e\.key === 'Escape'/);
    assert.match(v, /ArrowRight/);
    assert.match(v, /useReducedMotion/);
    assert.match(v, /const autoplay = !reduced && !paused/);
    assert.match(v, /aria-label="Close"/);
  });

  it('Thanksgiving invite uses the Vault form, menu and WhatsApp share', () => {
    const inv = read('components/sanctuary/HolidayInviteStory.tsx');
    assert.match(inv, /vaultEventRsvpUrl\(rsvp\.eventId\)/);
    assert.match(inv, /Save my family’s seats/);
    assert.match(inv, /Invite family on WhatsApp/);
    const rsvps = read('lib/holidayRsvps.ts');
    assert.match(rsvps, /menu: THANKSGIVING_2026_MENU/);
    assert.match(rsvps, /'Matooke'/);
  });
});

describe('attendance plans', () => {
  it('self-only RLS store, proposed as SQL (not shipped as a migration)', () => {
    const sql = read('docs/supabase/connect_attendance_plans.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.attendance_plans/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /USING \(user_id = auth\.uid\(\)\)/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.attendance_plans FROM anon/);
    assert.match(sql, /UNIQUE \(user_id, plan_key\)/);
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
  });

  it('client uses the member session and keeps the plan on the phone until the table exists', () => {
    const c = read('lib/attendancePlanClient.ts');
    assert.match(c, /from\('attendance_plans'\)/);
    assert.match(c, /isMissingStoreError/);
    assert.match(c, /'42P01'/);
    assert.match(c, /localStorage/);
    assert.equal(/service_role|SERVICE_ROLE/.test(c), false);
    const ticket = read('components/sanctuary/NextUpTicket.tsx');
    assert.match(ticket, /I’ll be there/);
    assert.match(ticket, /aria-pressed=\{going\}/);
    assert.match(ticket, /<CountdownRing/);
  });
});

describe('Me: wallet card and podium', () => {
  it('Me shows the wallet PLCC Card before points; card page has the sheen', () => {
    const me = read('pages/MemberMore.tsx');
    assert.ok(me.indexOf('<WalletCard') > -1 && me.indexOf('<WalletCard') < me.indexOf('<MyPointsCard />'));
    assert.match(read('components/sanctuary/WalletCard.tsx'), /to="\/card"/);
    assert.match(read('pages/MemberCard.tsx'), /useTiltSheen\(cardRef, Boolean\(card\)\)/);
    assert.match(read('components/points/MyPointsCard.tsx'), /<SeasonPodium board=\{board\}/);
  });
});

describe('motion and type', () => {
  it('every Sanctuary animation stops under reduce motion', () => {
    const css = read('index.css');
    const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.awc-stained-glass__glow', '.awc-live-dot', ".awc-wallet[data-sheen='ambient'] .awc-wallet__sheen", '.awc-ring__fill', '.awc-story-bar__fill']) {
      assert.ok(reduce.includes(sel), sel);
    }
    assert.match(read('lib/useTiltSheen.ts'), /reduced\) \{\s*setMode\('static'\)/);
  });

  it('Sanctuary components keep text at 12px or larger', () => {
    for (const f of ['NextUpTicket', 'TodayStories', 'StoryViewer', 'SundayLiveHome', 'WalletCard', 'SeasonPodium', 'HolidayInviteStory', 'StainedGlassGreeting', 'CountdownRing']) {
      const src = read(`components/sanctuary/${f}.tsx`);
      for (const m of src.matchAll(/text-\[(\d+)px\]/g)) assert.ok(Number(m[1]) >= 12, `${f}: ${m[0]}`);
    }
    assert.equal(/text-\[11px\]/.test(read('components/MemberNav.tsx')), false);
  });
});

describe('visitor Home (Sanctuary)', () => {
  it('visitor hero uses the stained glass, a Plan-a-visit ticket and stories without Canaan News', () => {
    const hero = read('components/home/HomeHero.tsx');
    assert.match(hero, /<StainedGlass \/>/);
    assert.match(hero, /<NextUpTicket next=\{next\} liveUrl=\{liveUrl\} visitor \/>/);
    assert.match(hero, /<TodayStories visitor \/>/);
    assert.match(hero, /as="p"/, 'keeps the single sr-only h1');
    const ticket = read('components/sanctuary/NextUpTicket.tsx');
    assert.match(ticket, /Plan a visit/);
    assert.match(ticket, /next && !visitor \? planKeyFor/);
    assert.match(read('components/sanctuary/TodayStories.tsx'), /if \(!visitor\) \{\s*fetchVaultNews/);
  });

  it('visitor bottom bar is the glass dock with labels', () => {
    const nav = read('components/BottomNav.tsx');
    assert.match(nav, /awc-dock/);
    const labels = [...nav.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Home', 'Watch', 'Events', 'Prayer', 'Visit']);
    assert.match(nav, /prefers-reduced-motion/);
  });
});

describe('Home Live Huddles', () => {
  it('lists live channel huddles busiest first and builds one-tap room links', async () => {
    const h = await load('lib/liveHuddles.ts');
    const rows = h.liveHuddleRows(
      [{ id: 'a', name: 'Prayer' }, { id: 'b', name: 'Youth' }, { id: 'c', name: 'Men' }],
      { a: { live: true, participantCount: 2 }, b: { live: false, participantCount: 0 }, c: { live: true, participantCount: 5 } }
    );
    assert.deepEqual(rows.map((r) => r.id), ['c', 'a']);
    assert.equal(h.huddleRoomPath('abc', 'join'), '/community/chat/abc?huddle=join');
    assert.equal(h.parseHuddleIntent('?huddle=start'), 'start');
    assert.equal(h.parseHuddleIntent('?huddle=x'), null);
  });

  it('Home shows Live Huddles; the room asks for a tap before the mic starts', () => {
    assert.match(read('components/member/MemberHomeHeader.tsx'), /<LiveHuddles \/>/);
    const lh = read('components/sanctuary/LiveHuddles.tsx');
    assert.match(lh, /fetchHuddleStatuses/);
    assert.match(lh, /isDmChannel/);
    assert.match(lh, /fetchFamilyHuddleStatus/);
    assert.match(lh, /document\.visibilityState === 'visible'/);
    const room = read('pages/CommunityChatRoom.tsx');
    assert.match(room, /parseHuddleIntent\(location\.search\)/);
    assert.match(room, /Not now/);
  });
});

describe('Sermon Notes: study guides from Vault', () => {
  it('sanitizes guides and only forwards valid share tokens', async () => {
    const s = await load('api/_utils/studyGuidesSanitize.js');
    assert.equal(s.sanitizeGuideCard({ shareToken: 'nope', title: 'X' }), null);
    const card = s.sanitizeGuideCard({ id: 'g1', shareToken: 'a'.repeat(24), title: ' Faith ', shareUrl: 'javascript:alert(1)', dayCount: 99 });
    assert.equal(card.title, 'Faith');
    assert.equal(card.shareUrl, null);
    assert.equal(card.dayCount, 14);
    const guide = s.sanitizeGuide({ shareToken: 'b'.repeat(24), days: [{ dayNumber: 1, title: 'Rest' }, { dayNumber: 0 }], coverUrl: 'https://x.test/c.jpg' });
    assert.equal(guide.days.length, 1);
    assert.equal(guide.coverUrl, 'https://x.test/c.jpg');
  });

  it('rides the existing Canaan News function (no new API file) to Vault rhemanotes', () => {
    const bridge = read('api/_utils/studyGuidesBridge.js');
    assert.match(bridge, /SHARE_TOKEN_RE\.test\(token\)/);
    assert.match(read('api/_utils/vaultOrigin.js'), /resource=rhemanotes&action=library/);
    assert.match(read('api/vault-news.js'), /handleStudyGuidesBridge/);
    assert.match(read('vercel.json'), /"source": "\/api\/study-guides"/);
    assert.match(read('pages/MemberNotes.tsx'), /<StudyGuidesSection \/>/);
    assert.match(read('App.tsx'), /path="\/notes\/guide\/:token"/);
  });
});
