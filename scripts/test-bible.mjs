import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseApiBibleText, handleBibleBridge } from '../api/_utils/bibleBridge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const booksSrc = readFileSync(join(root, 'lib/bibleBooks.ts'), 'utf8');
const BOOKS = [...booksSrc.matchAll(/\{ id: '([1-3A-Z]{3})', name: '([^']+)', chapters: (\d+), testament: '(OT|NT)' \}/g)].map((m) => ({
  id: m[1],
  name: m[2],
  chapters: Number(m[3]),
  testament: m[4],
}));

test('book list is the full 66-book canon', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS.filter((b) => b.testament === 'OT').length, 39);
  assert.equal(BOOKS.reduce((n, b) => n + b.chapters, 0), 1189);
  assert.equal(BOOKS[42].id, 'JHN');
});

test('bundled KJV has every book, chapter and verse', () => {
  const dir = join(root, 'public/bible/kjv');
  assert.equal(readdirSync(dir).filter((f) => f.endsWith('.json')).length, 66);
  let verses = 0;
  for (const b of BOOKS) {
    const chapters = JSON.parse(readFileSync(join(dir, `${b.id}.json`), 'utf8'));
    assert.equal(chapters.length, b.chapters, `${b.name} chapter count`);
    for (const c of chapters) {
      assert.ok(c.length > 0);
      for (const v of c) assert.ok(typeof v === 'string' && v.length > 0);
      verses += c.length;
    }
  }
  assert.equal(verses, 31102);
  const john = JSON.parse(readFileSync(join(dir, 'JHN.json'), 'utf8'));
  assert.match(john[2][15], /^For God so loved the world/);
  const matt = JSON.parse(readFileSync(join(dir, 'MAT.json'), 'utf8'));
  assert.match(matt[17][18], /if two of you shall agree on earth/);
});

test('API.Bible text content splits into verses', () => {
  const v = parseApiBibleText('     [1] In the beginning was the Word.  [2] He was with God\n in the beginning. [3] Through him all things were made.');
  assert.deepEqual(v.map((x) => x.n), [1, 2, 3]);
  assert.equal(v[1].text, 'He was with God in the beginning.');
  assert.deepEqual(parseApiBibleText(''), []);
});

function fakeRes() {
  const out = { status: 0, body: null, headers: {} };
  return {
    out,
    setHeader(k, v) { out.headers[k] = v; },
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
  };
}

test('NIV stays off until the key and Bible id are set', async () => {
  delete process.env.API_BIBLE_KEY;
  delete process.env.API_BIBLE_NIV_ID;
  let r = fakeRes();
  await handleBibleBridge({ method: 'GET', query: { status: '1' }, headers: {} }, r);
  assert.equal(r.out.status, 200);
  assert.equal(r.out.body.niv, false);
  r = fakeRes();
  await handleBibleBridge({ method: 'GET', query: { t: 'niv', chapter: 'JHN.3' }, headers: {} }, r);
  assert.equal(r.out.status, 503);
  assert.equal(r.out.body.code, 'not_configured');
});

test('NIV requests need sign-in and a valid chapter; key never echoed', async () => {
  process.env.API_BIBLE_KEY = 'secret-key-123';
  process.env.API_BIBLE_NIV_ID = '78a9f6124f344018-01';
  let r = fakeRes();
  await handleBibleBridge({ method: 'GET', query: { status: '1' }, headers: {} }, r);
  assert.equal(r.out.body.niv, true);
  assert.equal(JSON.stringify(r.out.body).includes('secret'), false);
  r = fakeRes();
  await handleBibleBridge({ method: 'GET', query: { t: 'niv', chapter: 'JHN.3' }, headers: {} }, r);
  assert.equal(r.out.status, 401);
  r = fakeRes();
  await handleBibleBridge({ method: 'GET', query: { t: 'niv', chapter: '../x' }, headers: { authorization: 'Bearer a.b.c' } }, r);
  assert.equal(r.out.status, 400);
  delete process.env.API_BIBLE_KEY;
  delete process.env.API_BIBLE_NIV_ID;
});

test('Bible is wired into routes, rewrites and the Me tab', () => {
  assert.match(readFileSync(join(root, 'App.tsx'), 'utf8'), /path="\/bible"/);
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const i = vercel.rewrites.findIndex((r) => r.source === '/api/bible');
  assert.ok(i >= 0 && vercel.rewrites[i].destination === '/api/vault-news?bridge=bible');
  assert.ok(i < vercel.rewrites.findIndex((r) => r.source === '/api/(.*)'));
  assert.match(readFileSync(join(root, 'api/vault-news.js'), 'utf8'), /handleBibleBridge/);
  assert.match(readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8'), /to: '\/bible'/);
});

test('typed references like "John 3:16" and "1 Cor 13" are understood', async () => {
  const { parseReference, stepChapter } = await import('../lib/bibleBooks.ts');
  const t = (q) => {
    const r = parseReference(q);
    return r ? `${r.book.id} ${r.chapter}${r.verse ? ':' + r.verse : ''}${r.verseEnd ? '-' + r.verseEnd : ''}` : null;
  };
  const cases = [
    ['John 3:16', 'JHN 3:16'], ['jn 3 16', 'JHN 3:16'], ['1 Cor 13', '1CO 13'], ['1cor 13:4-7', '1CO 13:4-7'],
    ['Ps 23', 'PSA 23'], ['Song of Solomon 2', 'SNG 2'], ['Jude 3', 'JUD 1:3'], ['Matt 18:19', 'MAT 18:19'],
    ['First John 4:8', '1JN 4:8'], ['II Kings 2', '2KI 2'], ['john 99', null], ['xyz 1', null], ['Phil 4:13', 'PHP 4:13'],
  ];
  for (const [q, want] of cases) assert.equal(t(q), want, q);
  assert.deepEqual(stepChapter('MAL', 4, 1), { bookId: 'MAT', chapter: 1 });
  assert.equal(stepChapter('REV', 22, 1), null);
});
