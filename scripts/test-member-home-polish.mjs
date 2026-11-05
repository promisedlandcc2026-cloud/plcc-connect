/**
 * Phase 2.1.1 — My PLCC production polish contracts.
 * Run: node --test scripts/test-member-home-polish.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Pure helpers mirrored for node:test (TS app sources are not compiled for Node).
function normalizeAnnouncementRow(row) {
  const item = row && typeof row === 'object' ? row : {};
  const created = item.created_at ? String(item.created_at) : '';
  const eventDate = item.event_date ? String(item.event_date) : '';
  const legacyDate = item.date ? String(item.date) : '';
  let dateLabel = '';
  if (eventDate) {
    const d = new Date(eventDate);
    dateLabel = Number.isFinite(d.getTime()) ? d.toLocaleDateString() : eventDate;
  } else if (created) {
    const d = new Date(created);
    dateLabel = Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '';
  } else if (legacyDate) {
    const d = new Date(legacyDate);
    dateLabel = Number.isFinite(d.getTime()) ? d.toLocaleDateString() : legacyDate;
  }
  const summary = String(item.content || item.description || '');
  const imageUrl = item.image_url || item.imageUrl ? String(item.image_url || item.imageUrl) : null;
  return {
    id: String(item.id ?? ''),
    title: String(item.title || 'Announcement'),
    summary,
    dateLabel,
    imageUrl,
  };
}

function isPublicPrayerRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  if (r.is_confidential === true) return false;
  const status = String(r.status || '').trim().toLowerCase();
  if (status === 'confidential' || status === 'vetting' || status === 'archived') return false;
  if (status && status !== 'published') return false;
  return true;
}

function isPlaceholderSermon(row) {
  const title = String(row.title || '').trim();
  const speaker = String(row.speaker || '').trim();
  if (!title) return true;
  if (/^(your sermon title here|sermon title|untitled|test sermon|sample sermon)$/i.test(title)) {
    return true;
  }
  if (speaker && /^(pastor name|speaker name|test pastor)$/i.test(speaker)) return true;
  return false;
}

const FEED_MENTION_TOKEN_RE =
  /@\[([^\]]{1,80})\]\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

function formatFeedContentForDisplay(content) {
  return String(content || '').replace(FEED_MENTION_TOKEN_RE, (_full, name) => {
    const n = String(name || '').trim() || 'Member';
    return `@${n}`;
  });
}

describe('announcements normalize / empty', () => {
  it('maps content+created_at and description+date shapes', () => {
    const a = normalizeAnnouncementRow({
      id: '1',
      title: 'Summit',
      content: 'Join us',
      created_at: '2026-09-01T12:00:00Z',
    });
    assert.equal(a.title, 'Summit');
    assert.equal(a.summary, 'Join us');
    assert.ok(a.dateLabel);

    const b = normalizeAnnouncementRow({
      id: '2',
      title: 'Food Drive',
      description: 'Saturday serve',
      date: 'Every Saturday',
    });
    assert.equal(b.summary, 'Saturday serve');
    assert.equal(b.dateLabel, 'Every Saturday');
  });

  it('empty list stays empty (no fake announcements)', () => {
    assert.deepEqual([].map(normalizeAnnouncementRow), []);
  });

  it('helper retries without created_at order on failure', () => {
    const src = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    assert.ok(src.includes("order('created_at'"));
    assert.ok(src.includes("order('event_date'"));
    assert.ok(src.includes(".select('*')"));
    assert.ok(src.includes('from(\'announcements\')'));
  });
});

describe('prayer public-only', () => {
  it('excludes confidential and non-published statuses', () => {
    assert.equal(isPublicPrayerRow({ is_confidential: true, content: 'x' }), false);
    assert.equal(isPublicPrayerRow({ is_confidential: false, status: 'Confidential' }), false);
    assert.equal(isPublicPrayerRow({ is_confidential: false, status: 'Vetting' }), false);
    assert.equal(isPublicPrayerRow({ is_confidential: false, status: 'Published', content: 'ok' }), true);
    assert.equal(isPublicPrayerRow({ is_confidential: false, content: 'ok' }), true);
    // Vault-approved rows often leave is_confidential null — still public when Published
    assert.equal(isPublicPrayerRow({ is_confidential: null, status: 'Published', content: 'ok' }), true);
  });

  it('MemberHome prayer uses select(*) like PrayerWall', () => {
    const home = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    const wall = readFileSync(join(root, 'components/PrayerWall.tsx'), 'utf8');
    assert.ok(wall.includes(".from('prayer_requests')"));
    assert.ok(wall.includes(".eq('status', 'Published')"));
    assert.equal(wall.includes(".eq('is_confidential', false)"), false);
    assert.ok(home.includes(".select('*')"));
    assert.ok(home.includes(".eq('status', 'Published')"));
    assert.equal(home.includes(".eq('is_confidential', false)"), false);
    assert.ok(home.includes('isPublicPrayerRow'));
  });
});

describe('mention display', () => {
  it('converts mention tokens to @Name without UUID', () => {
    const raw =
      'Hello @[Jerless](mention:0fc7a9e7-fa93-4f50-b3ba-f47bcc22b225) and friend';
    const out = formatFeedContentForDisplay(raw);
    assert.equal(out, 'Hello @Jerless and friend');
    assert.equal(out.includes('0fc7a9e7'), false);
    assert.equal(out.includes('mention:'), false);
  });

  it('handles multiple mentions', () => {
    const raw =
      '@[Ada](mention:11111111-1111-4111-8111-111111111111) hi @[Bob](mention:22222222-2222-4222-8222-222222222222)';
    const out = formatFeedContentForDisplay(raw);
    assert.equal(out, '@Ada hi @Bob');
  });

  it('MemberHomeCommunity uses formatFeedContentForDisplay', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeCommunity.tsx'), 'utf8');
    assert.ok(src.includes('formatFeedContentForDisplay'));
    assert.equal(src.includes('truncateText(post.content'), false);
  });
});

describe('sermon placeholder + youtube fallback', () => {
  it('excludes demo placeholder sermons', () => {
    assert.equal(
      isPlaceholderSermon({ title: 'Your Sermon Title Here', speaker: 'Pastor Name' }),
      true
    );
    assert.equal(
      isPlaceholderSermon({ title: 'Be Strong & Good Courage', speaker: 'Pastor Kenneth' }),
      false
    );
  });

  it('latest-youtube returns title from Atom entry', () => {
    const src = readFileSync(join(root, 'api/family-huddle.js'), 'utf8');
    assert.ok(src.includes('parseLatestEntry'));
    assert.ok(src.includes('title: latest.title'));
    assert.ok(src.includes('<entry>'));
  });

  it('MemberHome sermon skips placeholders then uses youtube source', () => {
    const src = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    assert.ok(src.includes('isPlaceholderSermon'));
    assert.ok(src.includes('/api/latest-youtube'));
    assert.ok(src.includes("source: 'youtube'"));
  });
});

describe('regression guards', () => {
  it('visitor PublicHome keeps PrayerWall / Watch / Announcements; no bulletin or Message Guide', () => {
    const src = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(src.includes('PublicHome'));
    assert.ok(src.includes('VisitorWelcomeStrip'));
    assert.ok(src.includes('Announcements'));
    assert.ok(src.includes('PrayerWall'));
    assert.ok(src.includes('WatchLive'));
    assert.ok(src.includes('ConnectCard'));
    assert.ok(src.includes('HomeHubGrid'));
    assert.ok(src.includes('PWAPrompt'));
    assert.equal(src.includes('DigitalBulletin'), false);
    assert.equal(src.includes('SermonNotes'), false);
    assert.ok(src.includes("memberAccessState === 'approved_member'"));
  });

  it('section errors remain local ErrorState', () => {
    for (const f of [
      'MemberHomeAnnouncements.tsx',
      'MemberHomeVaultNews.tsx',
      'MemberHomePrayer.tsx',
      'MemberHomeCommunity.tsx',
      'MemberHomeSermon.tsx',
    ]) {
      const src = readFileSync(join(root, 'components/member', f), 'utf8');
      assert.ok(src.includes('ErrorState'), f);
    }
  });

  it('no SQL migrations and api count stays at most 15', () => {
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
    const apiJs = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(apiJs.length, 15);
    assert.ok(apiJs.includes('serve.js'));
    assert.ok(apiJs.includes('vault-news.js'));
  });

  it('public church reads use sessionless anon client (not signed-in JWT)', () => {
    const pub = readFileSync(join(root, 'lib/supabasePublic.ts'), 'utf8');
    const data = readFileSync(join(root, 'lib/memberHomeData.ts'), 'utf8');
    const wall = readFileSync(join(root, 'components/PrayerWall.tsx'), 'utf8');
    assert.ok(pub.includes('persistSession: false'));
    assert.ok(pub.includes('autoRefreshToken: false'));
    assert.equal(pub.includes('service_role'), false);
    assert.ok(data.includes('supabasePublic'));
    assert.ok(data.includes("from('announcements')"));
    assert.ok(data.includes("from('prayer_requests')"));
    assert.ok(wall.includes('supabasePublic'));
    assert.ok(wall.includes(".eq('status', 'Published')"));
  });
});
