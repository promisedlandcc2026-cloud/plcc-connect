import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('word search matches whole-word starts, all words, any order', async () => {
  const { buildMatcher } = await import('../lib/bibleSearchMatch.ts');
  assert.equal(buildMatcher(''), null);
  assert.equal(buildMatcher('a'), null);
  const love = buildMatcher('love');
  assert.ok(love('For God so loved the world'));
  assert.ok(!love('a glove'));
  const both = buildMatcher('life everlasting');
  assert.ok(both('should not perish, but have everlasting life.'));
  assert.ok(!both('everlasting arms'));
  assert.ok(buildMatcher('(peace)!')('Peace I leave with you'));
});

test('searching the bundled KJV for "everlasting life" finds John 3:16', async () => {
  const { buildMatcher } = await import('../lib/bibleSearchMatch.ts');
  const match = buildMatcher('everlasting life');
  const dir = join(root, 'public/bible/kjv');
  const hits = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    JSON.parse(readFileSync(join(dir, f), 'utf8')).forEach((verses, c) =>
      verses.forEach((t, v) => match(t) && hits.push(`${f.replace('.json', '')} ${c + 1}:${v + 1}`))
    );
  }
  assert.ok(hits.includes('JHN 3:16'));
  assert.ok(hits.length > 10 && hits.length < 200);
});

test('Bible page: home + reader, deep links open the reader, back button returns home', () => {
  const page = read('pages/MemberBible.tsx');
  assert.match(page, /params\.get\('view'\) === 'read'/);
  assert.match(page, /setParams\(\{ view: 'read' \}, \{ replace: true \}\)/);
  assert.match(page, /<BibleHome/);
  assert.match(page, /<BibleReader/);
});

test('reader offers highlight, copy, share, bookmark and add to notes', () => {
  const sheet = read('components/bible/VerseSheet.tsx');
  for (const label of ['Copy', 'Share', 'Bookmark', 'Add to notes', 'Remove highlight']) assert.ok(sheet.includes(label), label);
  const reader = read('components/bible/BibleReader.tsx');
  assert.match(reader, /navigate\(`\/notes\/new\?\$\{q\.toString\(\)\}`\)/);
  // Listen only for KJV (NIV's license may not cover audio).
  assert.match(reader, /speechSupported\(\) && translation === 'kjv'/);
});

test('note editor starts with the verse passed from the Bible', () => {
  const editor = read('pages/MemberNoteEditor.tsx');
  assert.match(editor, /searchParams\.get\('text'\)/);
});

test('highlights and bookmarks stay on the device under one storage key', () => {
  const marks = read('lib/bibleMarks.ts');
  assert.match(marks, /awc\.bible\.marks\.v1/);
  assert.match(marks, /awc\.bible\.recent\.v1/);
  assert.match(marks, /HIGHLIGHT_COLORS = \['gold', 'rose', 'blue', 'green'\]/);
});

test('bottom menu tucks away while reading and comes back on scroll up', async () => {
  const { nextHidden } = await import('../lib/dockAutoHide.ts');
  const page = { viewport: 800, pageHeight: 5000 };
  assert.equal(nextHidden(false, { y: 400, lastY: 300, ...page }), true, 'scrolling down hides');
  assert.equal(nextHidden(true, { y: 390, lastY: 400, ...page }), false, 'scrolling up shows');
  assert.equal(nextHidden(true, { y: 402, lastY: 400, ...page }), true, 'tiny jitter keeps state');
  assert.equal(nextHidden(true, { y: 40, lastY: 60, ...page }), false, 'near the top shows');
  assert.equal(nextHidden(false, { y: 4180, lastY: 4000, ...page }), false, 'end of chapter shows');

  const reader = read('components/bible/BibleReader.tsx');
  assert.match(reader, /useAutoHideDock\(selected\.size === 0\)/);
  assert.match(reader, /dockHidden \? 'translate-y-\[84px\]'/);
  for (const dock of ['components/BottomNav.tsx', 'components/MemberNav.tsx']) {
    const src = read(dock);
    assert.match(src, /useDockHidden\(\)/, dock);
    assert.match(src, /onFocusCapture=\{showDock\}/, dock);
  }
});
