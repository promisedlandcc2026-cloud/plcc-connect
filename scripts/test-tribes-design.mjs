/**
 * PLCC Tribes — Community feed + Scripture post design.
 * Run: node --test scripts/test-tribes-design.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

async function load(entry) {
  const out = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, format: 'esm', platform: 'neutral' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

const SITE = 'https://sanctum-live-nine.vercel.app';
const verseContent = (note = '') =>
  `${note ? `${note}\n\n` : ''}📖 Psalms 133:1 · KJV\n“Behold, how good and how pleasant it is for brethren to dwell together in unity!”\n${SITE}/bible?t=eng_kjv&b=PSA&c=133&v=1`;

describe('Scripture posts', async () => {
  const s = await load('lib/scripturePost.ts');

  it('recognises a verse shared from the church Bible reader', () => {
    const v = s.scriptureOf(verseContent('Good morning family'));
    assert.equal(v.ref, 'Psalms 133:1');
    assert.equal(v.translation, 'KJV');
    assert.equal(v.note, 'Good morning family');
    assert.match(v.text, /^Behold/);
    assert.equal(s.isScripturePost({ content: verseContent() }), true);
  });

  it('ordinary posts and look-alike verses from other sites are not Scripture', () => {
    assert.equal(s.isScripturePost({ content: 'Welcome to Tribes!' }), false);
    assert.equal(s.isScripturePost({ content: '' }), false);
    const forged = verseContent().replace(SITE, 'https://evil.example.com');
    assert.equal(s.isScripturePost({ content: forged }), false);
  });

  it('filters keep feed order (pinned first) and All shows everything', () => {
    const posts = [
      { id: 'pin', pinned: true, content: 'Welcome' },
      { id: 'v1', content: verseContent() },
      { id: 'x', content: 'Praise report' },
      { id: 'v2', content: verseContent('note') },
    ];
    assert.deepEqual(s.filterFeedPosts(posts, 'all').map((p) => p.id), ['pin', 'v1', 'x', 'v2']);
    assert.deepEqual(s.filterFeedPosts(posts, 'scripture').map((p) => p.id), ['v1', 'v2']);
  });

  it('view comes from ?view=scripture, anything else is All', () => {
    assert.equal(s.feedViewFromParams(new URLSearchParams('view=scripture')), 'scripture');
    assert.equal(s.feedViewFromParams(new URLSearchParams('view=hack')), 'all');
    assert.equal(s.feedViewFromParams(new URLSearchParams('')), 'all');
  });

  it('Share to Ka Link opens Ka Link’s existing verse share screen with only the passage', () => {
    assert.equal(
      s.kaLinkVerseSharePath(`${SITE}/bible?t=eng_kjv&b=PSA&c=133&v=1`),
      '/share?kind=verse&t=eng_kjv&b=PSA&c=133&v=1'
    );
    assert.equal(
      s.kaLinkVerseSharePath(`${SITE}/bible?t=lug&b=jhn&c=1&v=10-11`),
      '/share?kind=verse&t=lug&b=JHN&c=1&v=10-11'
    );
    assert.equal(s.kaLinkVerseSharePath(`${SITE}/bible?t=eng_kjv&b=PSA&c=133`), '/share?kind=verse&t=eng_kjv&b=PSA&c=133');
    assert.equal(s.kaLinkVerseSharePath(`${SITE}/notbible?t=eng_kjv&b=PSA&c=1`), null);
    assert.equal(s.kaLinkVerseSharePath(`${SITE}/bible?t=eng_kjv&b=PSA&c=1&v=1;drop`), null);
    assert.equal(s.kaLinkVerseSharePath('not a url'), null);
  });
});

describe('PLCC Tribes look (v2)', () => {
  it('woven hero artwork is small enough for mobile data', async () => {
    const { statSync } = await import('node:fs');
    assert.ok(statSync(join(root, 'public/brand/tribes-hero.webp')).size < 90_000);
    assert.match(read('index.css'), /\.tribes-hero \{[\s\S]*url\('\/brand\/tribes-hero\.webp'\)/);
  });
  it('weekday Home: forest bar with the mark, sky arch greeting (Luganda + English), ivory cards; Sunday live keeps the evening shell', () => {
    const h = read('components/member/MemberHomeHeader.tsx');
    assert.match(h, /tribes-bar[\s\S]*<TribesMark[\s\S]*>Tribes<[\s\S]*PROMISED LAND CC/);
    assert.match(h, /<SkyArchHero[\s\S]*lugandaGreeting\(now\)[\s\S]*memberHomeGreeting\(/);
    assert.match(h, /<TodayStories tone="light" \/>[\s\S]*<LiveHuddles tone="light" \/>/);
    assert.match(h, /if \(live\) \{[\s\S]*<SundayLiveHome/);
    assert.match(read('components/member/MemberHome.tsx'), /live \? 'awc-home-shell' : 'tribes-home'/);
  });
  it('page titles sit on the sky arch with a gold rule', () => {
    const h = read('components/member/MemberPageHeader.tsx');
    assert.match(h, /<SkyArchHero[\s\S]*tribes-gold-text font-display[\s\S]*h-\[3px\] w-12 rounded-full bg-\[#E4C36A\]/);
  });
  it('sky follows time of day and weather: sunny, cloudy, rainy, night', async () => {
    const { pickSky, skyForWeatherCode, isNightAt } = await import('../lib/tribesSky.ts').catch(() => ({}));
    const src = read('lib/tribesSky.ts');
    for (const k of ['sunny', 'cloudy', 'rainy', 'night']) assert.match(src, new RegExp(`/brand/sky/${k}\\.webp`));
    assert.match(src, /api\.open-meteo\.com/);
    assert.match(src, /saveData/);
    if (pickSky) {
      assert.equal(isNightAt(new Date(2026, 0, 1, 22, 0)), true);
      assert.equal(isNightAt(new Date(2026, 0, 1, 12, 0)), false);
      assert.equal(skyForWeatherCode(0), 'sunny');
      assert.equal(skyForWeatherCode(3), 'cloudy');
      assert.equal(skyForWeatherCode(63), 'rainy');
      assert.equal(skyForWeatherCode(95), 'rainy');
      assert.equal(pickSky(new Date(2026, 0, 1, 23, 0), 0), 'night');
    }
  });
  it('the forest theme is on and ticket cards exist', () => {
    assert.match(read('index.html'), /<html lang="en" class="tribes-forest">/);
    const css = read('index.css');
    assert.match(css, /\.tribes-ticket \{[\s\S]*mask:/);
    assert.match(css, /\.tribes-ticket::before/);
  });
});

describe('Tribes screens use the existing flows', () => {
  const feed = read('pages/CommunityFeed.tsx');
  const post = read('pages/CommunityPost.tsx');
  const actions = read('components/tribes/TribesPostActions.tsx');
  const header = read('components/tribes/TribesHeader.tsx');

  it('feed: header, hero, gold Create post opens the existing composer, two filters', () => {
    assert.match(feed, /<TribesHeader \/>/);
    assert.match(read('components/tribes/TribesHero.tsx'), /One family\.[\s\S]*Many nations\.[\s\S]*One purpose\./);
    assert.match(feed, /onClick=\{\(\) => setComposerOpen\(true\)\}[\s\S]*Create post/);
    assert.match(feed, /<CommunityPostComposer/);
    assert.match(feed, /'All posts'/);
    assert.match(feed, /'Scripture'/);
    assert.match(feed, /fetchCommunityFeedPage/);
  });

  it('header keeps notifications and uses the PLCC sun-and-road mark', () => {
    assert.match(header, /to="\/notifications"/);
    assert.match(header, /<TribesMark/);
    assert.match(read('components/tribes/TribesMark.tsx'), /fill="currentColor"/);
    assert.equal(/unsplash|generated|mockup/i.test(feed + post + header), false);
  });

  it('Like uses the existing like reaction; other reactions, comments and owner menus stay', () => {
    assert.match(actions, /toggleReaction\('post', post\.id, LIKE/);
    assert.match(actions, /only=\{OTHER_REACTIONS\}/);
    assert.match(post, /<CommunityCommentsSection/);
    assert.match(feed, /<CommunityPostOwnerActions/);
    assert.match(post, /<CommunityPostOwnerActions/);
  });

  it('Report post goes through the shared report dialog as a feed_post', () => {
    assert.match(actions, /openReport\(\{\s*kind: 'content',\s*contentType: 'feed_post'/);
    assert.match(post, /<ReportPostRow/);
  });

  it('Share to Ka Link uses the signed-in Ka Link handoff', () => {
    assert.match(actions, /kaLinkVerseShareUrl\(sharePath\)/);
    assert.match(read('lib/awcChatMove.ts'), /export async function kaLinkVerseShareUrl[\s\S]*awcChatSignedInUrl/);
  });

  it('routes stay behind approved-member access', () => {
    assert.match(read('App.tsx'), /path="\/community"\s*element=\{\s*<MemberGate requireAccess="approved_member">/);
  });
});
