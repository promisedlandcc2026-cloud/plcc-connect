import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const give = readFileSync(new URL('../components/GiveModule.tsx', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../lib/giving.ts', import.meta.url), 'utf8');

test('Give sheet sends every method through PLCC Tithe', () => {
  assert.match(give, /giveUrl\(\)/);
  assert.match(give, /giveUrl\(m\.id\)/);
  for (const m of ['card', 'bank', 'zelle', 'cashapp', 'venmo']) assert.match(give, new RegExp(`id: '${m}'`));
  assert.match(give, /myGivingUrl\(\)/);
});

test('No direct Zelle number or copy-to-clipboard giving (gifts would skip Finance matching)', () => {
  assert.doesNotMatch(give, /508 ?933 ?1804/);
  assert.doesNotMatch(give, /clipboard/);
});

test('Tithe links open safely in a new tab', () => {
  const blanks = give.match(/target="_blank"/g) || [];
  const safe = give.match(/rel="noopener noreferrer"/g) || [];
  assert.equal(blanks.length, safe.length);
});

test('Tithe URL is https-only with a safe default', () => {
  assert.match(lib, /https:\/\/awc-tithe\.onrender\.com/);
  assert.match(lib, /url\.protocol !== 'https:'/);
  assert.match(lib, /from: 'connect'/);
});
