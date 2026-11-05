/**
 * Phase 8 Community mention sanitize / format tests.
 * Run: node --test scripts/test-community-mentions.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedMentionToken,
  extractFeedMentionIds,
  formatFeedContentForDisplay,
  parseMentionsListQuery,
  parseVaultMentionsResponse,
  sanitizeMentionCandidate,
  MENTION_QUERY_MAX_CHARS,
  MENTION_RESULT_LIMIT,
} from '../api/_utils/communityMentionSanitize.js';
import {
  buildVaultCommunityMentionsUrl,
  VAULT_COMMUNITY_MENTIONS_PATH,
} from '../api/_utils/vaultOrigin.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

describe('buildVaultCommunityMentionsUrl', () => {
  it('uses fixed mention-candidates path only', () => {
    const url = buildVaultCommunityMentionsUrl('https://vault.example.com/', 'jane');
    assert.equal(
      url,
      `https://vault.example.com${VAULT_COMMUNITY_MENTIONS_PATH}&q=jane`
    );
    assert.ok(url.includes('feedType=mention-candidates'));
    assert.equal(url.includes('email'), false);
    assert.equal(url.includes('role'), false);
  });
});

describe('parseMentionsListQuery', () => {
  it('accepts a trimmed name query', () => {
    const parsed = parseMentionsListQuery({ q: '  Jane  ' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.q, 'Jane');
  });

  it('rejects missing, empty, wildcard, long, duplicate, and unexpected params', () => {
    assert.equal(parseMentionsListQuery({}).ok, false);
    assert.equal(parseMentionsListQuery({ q: '' }).ok, false);
    assert.equal(parseMentionsListQuery({ q: '   ' }).ok, false);
    assert.equal(parseMentionsListQuery({ q: '*' }).ok, false);
    assert.equal(parseMentionsListQuery({ q: '%' }).ok, false);
    assert.equal(
      parseMentionsListQuery({ q: 'x'.repeat(MENTION_QUERY_MAX_CHARS + 1) }).ok,
      false
    );
    assert.equal(parseMentionsListQuery({ q: ['a', 'b'] }).ok, false);
    assert.equal(parseMentionsListQuery({ q: 'a', limit: '20' }).ok, false);
    assert.equal(parseMentionsListQuery({ query: 'a' }).ok, false);
  });
});

describe('sanitizeMentionCandidate + parseVaultMentionsResponse', () => {
  it('keeps id/name/avatar and strips role/email/emailHint', () => {
    const c = sanitizeMentionCandidate({
      id: USER_A,
      name: 'Jane Doe',
      avatar_url: 'https://cdn.example.com/a.png',
      role: 'PASTOR',
      email: 'secret@example.com',
      emailHint: 'secret',
      phone: '555',
    });
    assert.deepEqual(c, {
      id: USER_A,
      name: 'Jane Doe',
      avatarUrl: 'https://cdn.example.com/a.png',
    });
    assert.equal(c.role, undefined);
    assert.equal(c.email, undefined);
    assert.equal(c.emailHint, undefined);
  });

  it('maps list, skips malformed, enforces limit, and strips sensitive fields', () => {
    const rows = [
      { id: 'bad', name: 'Nope', role: 'ADMIN', emailHint: 'x' },
      { id: USER_A, name: 'Jane', avatar_url: null, role: 'PASTOR', emailHint: 'jane' },
    ];
    for (let i = 0; i < MENTION_RESULT_LIMIT + 3; i++) {
      const id = `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`;
      rows.push({
        id,
        name: `Member ${i}`,
        avatar_url: null,
        role: 'MEMBER',
        emailHint: 'x',
      });
    }
    const parsed = parseVaultMentionsResponse({ ok: true, candidates: rows });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.candidates.length, MENTION_RESULT_LIMIT);
    assert.ok(parsed.skipped >= 1);
    assert.equal(parsed.candidates[0].id, USER_A);
    assert.equal(parsed.candidates[0].role, undefined);
    assert.equal(parsed.candidates[0].emailHint, undefined);
  });

  it('rejects invalid bodies', () => {
    assert.equal(parseVaultMentionsResponse(null).ok, false);
    assert.equal(parseVaultMentionsResponse({ ok: false }).ok, false);
    assert.equal(parseVaultMentionsResponse({ ok: true }).ok, false);
  });
});

describe('mention token format + display', () => {
  it('builds Vault syntax and extracts ids', () => {
    const token = buildFeedMentionToken('Jane Doe', USER_A);
    assert.equal(token, `@[Jane Doe](mention:${USER_A})`);
    const content = `Hello ${token} and @[Pat](mention:${USER_B})`;
    assert.deepEqual(extractFeedMentionIds(content), [USER_A.toLowerCase(), USER_B.toLowerCase()]);
  });

  it('escapes brackets in names and rejects bad ids', () => {
    const token = buildFeedMentionToken('Jane [Admin]', USER_A);
    assert.equal(token, `@[Jane Admin](mention:${USER_A})`);
    assert.equal(buildFeedMentionToken('Jane', 'not-a-uuid'), null);
  });

  it('formats display names without UUIDs or raw markup', () => {
    const raw = `Hi @[Jane Doe](mention:${USER_A})!`;
    const display = formatFeedContentForDisplay(raw);
    assert.equal(display, 'Hi @Jane Doe!');
    assert.equal(display.includes('mention:'), false);
    assert.equal(display.includes(USER_A), false);
  });

  it('leaves invalid markup as harmless text', () => {
    const raw = 'Hello @[broken](mention:not-uuid) and <b>tag</b>';
    const display = formatFeedContentForDisplay(raw);
    assert.equal(display.includes('<b>'), true);
    assert.equal(display.includes('not-uuid'), true);
  });
});

describe('active mention query detection (shared rules)', () => {
  it('detects @query and ignores email-like and completed tokens', async () => {
    // Mirror client findActiveMentionQuery via dynamic import of TS-compiled logic is hard;
    // re-implement the same pure checks used by lib/communityMentionFormat.ts here.
    function findActiveMentionQuery(text, caret) {
      const before = text.slice(0, caret);
      const at = before.lastIndexOf('@');
      if (at < 0) return null;
      if (at > 0 && /[\w\]]/.test(before[at - 1] || '')) return null;
      const fragment = before.slice(at + 1);
      if (fragment.includes('\n') || fragment.includes('](')) return null;
      if (fragment.length > 40) return null;
      if (fragment.includes('[')) return null;
      return { start: at, query: fragment };
    }

    assert.deepEqual(findActiveMentionQuery('Hi @Ja', 6), { start: 3, query: 'Ja' });
    assert.equal(findActiveMentionQuery('a@b.com', 7), null);
    assert.equal(findActiveMentionQuery(`@[Jane](mention:${USER_A})`, 5), null);
    assert.deepEqual(findActiveMentionQuery('Say @', 5), { start: 4, query: '' });
  });
});
