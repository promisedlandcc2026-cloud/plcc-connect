/**
 * Phase 2.2 — Ministry Hubs contracts.
 * Run: node --test scripts/test-ministry-hubs.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);
const { sanitizeChatChannel } = require('../api/_utils/communityChatSanitize.js');

function slugifyMinistryName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'ministry';
}

function findMinistryBySlug(ministries, slug) {
  const target = String(slug || '').trim().toLowerCase();
  if (!target) return null;
  return ministries.find((m) => slugifyMinistryName(m.name) === target) || null;
}

const AUTH_EXACT_PATHS = new Set([
  '/sign-in',
  '/auth/callback',
  '/account',
  '/community',
  '/notifications',
  '/prayer',
  '/events',
  '/more',
  '/ministries',
]);

function isCommunityMemberPath(pathname) {
  return pathname === '/community' || pathname.startsWith('/community/');
}

function isMinistryHubPath(pathname) {
  return pathname === '/ministries' || pathname.startsWith('/ministries/');
}

function isAuthShellPath(pathname) {
  if (AUTH_EXACT_PATHS.has(pathname)) return true;
  if (isMinistryHubPath(pathname)) return true;
  return isCommunityMemberPath(pathname);
}

describe('ministry slug helpers', () => {
  it('slugifies names with ampersands and punctuation', () => {
    assert.equal(slugifyMinistryName('Worship & Creative Arts'), 'worship-and-creative-arts');
    assert.equal(slugifyMinistryName("Family & Discipleship"), 'family-and-discipleship');
  });

  it('finds by slug and rejects unknown', () => {
    const list = [
      { name: 'Events', id: '1' },
      { name: 'Care & Outreach', id: '2' },
    ];
    assert.equal(findMinistryBySlug(list, 'events')?.id, '1');
    assert.equal(findMinistryBySlug(list, 'care-and-outreach')?.id, '2');
    assert.equal(findMinistryBySlug(list, 'not-a-real-ministry'), null);
  });
});

describe('routing + ACL contracts', () => {
  it('visitor PublicHome still mounts MinistriesSection', () => {
    const home = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(home.includes('MinistriesSection'));
    assert.ok(home.includes('id="ministries"'));
  });

  it('approved member routes use MemberGate approved_member', () => {
    const app = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(app.includes('path="/ministries"'));
    assert.ok(app.includes('path="/ministries/:slug"'));
    assert.ok(app.includes('MemberMinistriesPage'));
    assert.ok(app.includes('MemberMinistryHubPage'));
    const ministriesBlock = app.slice(app.indexOf('path="/ministries"'));
    assert.ok(ministriesBlock.includes('requireAccess="approved_member"'));
  });

  it('ministry paths are auth shell + MemberNav', () => {
    assert.equal(isAuthShellPath('/ministries'), true);
    assert.equal(isAuthShellPath('/ministries/worship-and-creative-arts'), true);
    assert.equal(isMinistryHubPath('/ministries/events'), true);
    const shell = readFileSync(join(root, 'lib/memberShell.ts'), 'utf8');
    assert.ok(shell.includes('isMinistryHubPath'));
    assert.ok(shell.includes("'/ministries'"));
  });

  it('pending cannot use hubs without approved gate (source)', () => {
    const gate = readFileSync(join(root, 'components/auth/MemberGate.tsx'), 'utf8');
    assert.ok(gate.includes('approved_member'));
    assert.ok(gate.includes('requireAccess'));
  });
});

describe('directory + hub behavior', () => {
  it('directory page renders Open Ministry cards from live helper', () => {
    const page = readFileSync(join(root, 'pages/MemberMinistries.tsx'), 'utf8');
    assert.ok(page.includes('fetchMinistryDirectory'));
    assert.ok(page.includes('Open Ministry'));
    assert.ok(page.includes('My Ministries'));
    assert.ok(page.includes('Explore Ministries') || page.includes('All Ministries'));
  });

  it('hub handles unknown slug safely', () => {
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    assert.ok(hub.includes('Ministry unavailable'));
    assert.ok(hub.includes('fetchMinistryBySlug'));
  });

  it('My Ministries only when membership available and non-empty', () => {
    const page = readFileSync(join(root, 'pages/MemberMinistries.tsx'), 'utf8');
    assert.ok(page.includes('membershipAvailable && myMinistries.length > 0'));
  });

  it('Serve links to filtered /serve?ministryId= UUID', () => {
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    assert.ok(hub.includes('Serve with this ministry'));
    assert.ok(hub.includes('/serve?ministryId='));
    assert.ok(hub.includes('ministry.id'));
    assert.equal(hub.includes('Serve opportunities coming soon'), false);
  });

  it('events require real association — hubs do not invent matches', () => {
    const data = readFileSync(join(root, 'lib/ministryHubData.ts'), 'utf8');
    assert.ok(data.includes('ministryEventsSupported'));
    assert.ok(data.includes('return false'));
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    assert.ok(hub.includes('No upcoming ministry events'));
    assert.equal(hub.includes('.ilike('), false);
    assert.equal(hub.includes('title.ilike'), false);
  });

  it('leaders omit private contact fields', () => {
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    const data = readFileSync(join(root, 'lib/ministryHubData.ts'), 'utf8');
    assert.ok(data.includes('ministryLeadersSupported'));
    assert.equal(hub.includes('phone'), false);
    assert.equal(hub.includes('email'), false);
    assert.equal(hub.includes('leader_id'), false);
  });
});

describe('community + chat reuse', () => {
  it('hub links reuse /community and /community/chat', () => {
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    assert.ok(hub.includes('to="/community"'));
    assert.ok(hub.includes('to="/community/chat"') || hub.includes('`/community/chat/${'));
    assert.ok(hub.includes('fetchChatChannels'));
  });

  it('chat sanitize passes ministryId for ministry channels, never for direct messages', () => {
    const CHANNEL_ID = '11111111-1111-4111-8111-111111111111';
    const MINISTRY_ID = '22222222-2222-4222-8222-222222222222';
    const open = sanitizeChatChannel({
      id: CHANNEL_ID,
      name: 'Worship',
      visibility: 'ministry',
      ministry_id: MINISTRY_ID,
      participants: ['secret'],
      email: 'x@y.com',
    });
    assert.ok(open);
    assert.equal(open.ministryId, MINISTRY_ID);
    assert.equal('participants' in open, false);
    assert.equal('email' in open, false);
    // DMs are supported (see test-community-chat), but are anonymized and never
    // tagged with a ministry, so Ministry Hubs can't list them.
    const dm = sanitizeChatChannel({ id: CHANNEL_ID, name: 'DM_x', visibility: 'dm', ministry_id: MINISTRY_ID });
    assert.equal(dm.name, 'Direct message');
    assert.equal(dm.visibility, 'dm');
    assert.equal(dm.ministryId, null);
  });
});

describe('Home + More integration', () => {
  it('Home Ministries Quick Action routes to /ministries', () => {
    const qa = readFileSync(join(root, 'components/member/MemberHomeQuickActions.tsx'), 'utf8');
    assert.ok(qa.includes("to: '/ministries'"));
    assert.ok(qa.includes("label: 'Ministries'"));
    assert.equal(qa.includes("sectionId: 'ministries'"), false);
  });

  it('More Ministries routes to /ministries', () => {
    const more = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');
    assert.ok(more.includes("to: '/ministries'"));
    assert.ok(more.includes("label: 'Ministries'"));
    assert.equal(more.includes("sectionId: 'ministries'"), false);
  });

  it('MemberHome hubs teaser links to /ministries; PublicHome unchanged', () => {
    const member = readFileSync(join(root, 'components/member/MemberHome.tsx'), 'utf8');
    assert.ok(member.includes('to="/ministries"'));
    assert.equal(member.includes('MinistriesSection'), false);
    const publicHome = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(publicHome.includes('MinistriesSection'));
  });
});

describe('hygiene', () => {
  it('no SQL migrations; api/*.js count stays at current bridge maximum (15)', () => {
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
    const apiJs = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(apiJs.length, 15);
    assert.ok(apiJs.includes('serve.js'));
    assert.ok(apiJs.includes('vault-news.js'));
  });

  it('catalog uses public ministries/teams — no service role', () => {
    const data = readFileSync(join(root, 'lib/ministryHubData.ts'), 'utf8');
    assert.ok(data.includes('supabasePublic'));
    assert.ok(data.includes("from('ministries')"));
    assert.ok(data.includes("from('teams')"));
    assert.equal(data.includes('service_role'), false);
  });
});
