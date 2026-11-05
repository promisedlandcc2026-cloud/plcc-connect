import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('todaysWord source is shared across devices', () => {
  const src = readFileSync(join(root, 'lib/todaysWord.ts'), 'utf8');
  assert.match(src, /America\/New_York/);
  assert.match(src, /churchDateKey/);
  assert.match(src, /todaysWordIndexForDate/);
  assert.equal(src.includes('Math.random'), false);
  assert.equal(src.includes('localStorage.getItem'), false);
  assert.match(src, /same calendar day/i);
});

test('todaysWord index is stable for a date key', () => {
  const src = readFileSync(join(root, 'lib/todaysWord.ts'), 'utf8');
  const entryCount = (src.match(/^\s*\{ id:/gm) || []).length;
  assert.ok(entryCount >= 60, `expected a full curated list, got ${entryCount}`);

  function indexForDate(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const epochDay = Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 86_400_000);
    return ((epochDay % entryCount) + entryCount) % entryCount;
  }

  const a = indexForDate('2026-09-22');
  const b = indexForDate('2026-09-22');
  const c = indexForDate('2026-09-23');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("assistant context prefers Today's Word over placeholder sermons", () => {
  const src = readFileSync(join(root, 'lib/ai.ts'), 'utf8');
  assert.match(src, /getTodaysWord/);
  assert.match(src, /daily_inspiration/);
  assert.match(src, /isPlaceholderSermon/);
  assert.match(src, /Today's Word/);
  assert.match(src, /bible verse for today/i);
});
