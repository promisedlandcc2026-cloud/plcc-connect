/**
 * Canaan News + database health bridge contracts.
 * Run: node --test scripts/test-vault-news.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseNewsPostCommand,
  parseVaultHealthResponse,
  parseVaultNewsItemResponse,
  parseVaultNewsListResponse,
  sanitizeNewsItem,
} from '../api/_utils/vaultNewsSanitize.js';
import {
  buildVaultHealthUrl,
  buildVaultNewsUrl,
  VAULT_HEALTH_PATH,
  VAULT_NEWS_PATH,
} from '../api/_utils/vaultOrigin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('vault origin paths', () => {
  it('uses fixed Vault resources', () => {
    assert.equal(buildVaultNewsUrl('https://plcc-opal.vercel.app'), 'https://plcc-opal.vercel.app' + VAULT_NEWS_PATH);
    assert.equal(buildVaultHealthUrl('https://plcc-opal.vercel.app'), 'https://plcc-opal.vercel.app' + VAULT_HEALTH_PATH);
    assert.ok(VAULT_NEWS_PATH.includes('resource=vault-news'));
    assert.ok(VAULT_HEALTH_PATH.includes('resource=health'));
  });
});

describe('sanitize news', () => {
  it('accepts a valid item and drops extras', () => {
    const item = sanitizeNewsItem({
      id: 'a',
      created_at: '2026-10-14T00:00:00Z',
      title: 'Hello',
      body: 'Body',
      kind: 'celebration',
      author_name: 'Pastor',
      author_role: 'PASTOR',
      secret: 'nope',
    });
    assert.equal(item?.title, 'Hello');
    assert.equal(item?.kind, 'celebration');
    assert.equal('secret' in (item || {}), false);
  });

  it('rejects empty title and unknown kinds fall back on list only via normalize', () => {
    assert.equal(sanitizeNewsItem({ id: 'a', title: '', body: 'x' }), null);
    const item = sanitizeNewsItem({ id: 'a', title: 'T', body: 'B', kind: 'hacker' });
    assert.equal(item?.kind, 'church');
  });

  it('parses list, setup, and unavailable flags', () => {
    const list = parseVaultNewsListResponse({
      ok: true,
      news: [{ id: '1', title: 'T', body: 'B', kind: 'church' }],
      needsSetup: true,
    });
    assert.equal(list.ok, true);
    if (list.ok) {
      assert.equal(list.news.length, 1);
      assert.equal(list.needsSetup, true);
    }
    const down = parseVaultNewsListResponse({ ok: true, news: [], database: 'unavailable' });
    assert.equal(down.ok && down.database, 'unavailable');
  });

  it('parses created item', () => {
    const r = parseVaultNewsItemResponse({
      ok: true,
      item: { id: '1', title: 'T', body: 'B', kind: 'sympathy' },
    });
    assert.equal(r.ok, true);
  });
});

describe('post command', () => {
  it('accepts church kinds and rejects extras', () => {
    const ok = parseNewsPostCommand({ title: 'Hi', body: 'There', kind: 'church' });
    assert.equal(ok.ok, true);
    assert.equal(parseNewsPostCommand({ title: 'Hi', body: 'There', kind: 'church', extra: 1 }).ok, false);
    assert.equal(parseNewsPostCommand({ title: '', body: 'There' }).ok, false);
  });
});

describe('health', () => {
  it('maps healthy vs unavailable', () => {
    assert.equal(parseVaultHealthResponse({ ok: true, database: 'healthy' }).ok, true);
    assert.equal(parseVaultHealthResponse({ ok: true, database: 'unavailable' }).ok, true);
    assert.equal(parseVaultHealthResponse({ ok: true, database: 'weird' }).ok, false);
  });
});

describe('post roles + share', () => {
  it('Connect helpers match Vault writer set and share Connect home', () => {
    const src = readFileSync(join(root, 'lib/vaultNews.ts'), 'utf8');
    assert.match(src, /SUPER_ADMIN.*PASTOR.*MINISTRY_LEADER/);
    assert.match(src, /canPostVaultNews/);
    assert.match(src, /vaultNewsShareText/);
    assert.equal(src.includes('#/dashboard'), false);
    assert.match(src, /awc-connect\.vercel\.app|window\.location\.origin/);
  });
});

describe('source contracts', () => {
  it('handler is GET/POST + health probe; UI has badge and no Vault repair', () => {
    const api = readFileSync(join(root, 'api/vault-news.js'), 'utf8');
    const ui = readFileSync(join(root, 'components/member/MemberHomeVaultNews.tsx'), 'utf8');
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
    const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    assert.match(api, /isHealthProbe/);
    assert.match(api, /resource=vault-news|buildVaultNewsUrl/);
    assert.equal(api.includes('service_role'), false);
    assert.match(ui, /Database healthy/);
    assert.match(ui, /fetchDatabaseHealth/);
    assert.equal(ui.includes('vault-repair'), false);
    assert.match(vercel, /api\/vault-health/);
    assert.match(vite, /\/api\/vault-health/);
    assert.match(vite, /\/api\/vault-news/);
  });
});
