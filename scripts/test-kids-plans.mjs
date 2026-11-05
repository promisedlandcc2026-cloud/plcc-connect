/**
 * Kids Plans — Connect read-only bridge + UI contracts.
 * Run: node --test scripts/test-kids-plans.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseKidsPlansQuery,
  parseVaultKidsPlansResponse,
  sanitizeKidsPlanRow,
} from '../api/_utils/kidsPlansSanitize.js';
import {
  buildVaultKidsPlansUrl,
  VAULT_KIDS_PLANS_PATH,
} from '../api/_utils/vaultOrigin.js';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const PLAN_ID = '11111111-1111-4111-8111-111111111111';

function validPlan(overrides = {}) {
  return {
    id: PLAN_ID,
    serviceDate: '2026-03-15',
    classroom: 'Preschool',
    title: 'Palm Sunday',
    notes: 'Bring crafts',
    fileName: 'plan.pdf',
    contentType: 'application/pdf',
    signedUrl: 'https://example.com/signed/plan.pdf',
    uploadedBy: 'should-strip',
    canDelete: true,
    ...overrides,
  };
}

describe('kids-plans sanitize', () => {
  it('keeps safe fields and drops uploader/delete', () => {
    const row = sanitizeKidsPlanRow(validPlan());
    assert.ok(row);
    assert.deepEqual(Object.keys(row).sort(), [
      'classroom',
      'contentType',
      'fileName',
      'id',
      'notes',
      'serviceDate',
      'signedUrl',
      'title',
    ]);
    assert.equal(row.uploadedBy, undefined);
    assert.equal(row.canDelete, undefined);
  });

  it('rejects invalid id / missing classroom', () => {
    assert.equal(sanitizeKidsPlanRow(validPlan({ id: 'not-uuid' })), null);
    assert.equal(sanitizeKidsPlanRow(validPlan({ classroom: '' })), null);
  });

  it('rejects non-http signed urls', () => {
    assert.equal(sanitizeKidsPlanRow(validPlan({ signedUrl: 'javascript:alert(1)' }))?.signedUrl, null);
    assert.equal(sanitizeKidsPlanRow(validPlan({ signedUrl: 'ftp://x/y' }))?.signedUrl, null);
  });

  it('parses vault list and skips bad rows', () => {
    const parsed = parseVaultKidsPlansResponse({
      ok: true,
      plans: [validPlan(), { id: 'bad' }, validPlan({ id: '22222222-2222-4222-8222-222222222222' })],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.plans.length, 2);
  });

  it('parses year/classroom query', () => {
    assert.deepEqual(parseKidsPlansQuery('2026', '  Pre-K  '), {
      year: '2026',
      classroom: 'Pre-K',
    });
    assert.deepEqual(parseKidsPlansQuery('26', 'x'), { year: '', classroom: 'x' });
  });
});

describe('kids-plans vault origin', () => {
  it('uses fixed resource path', () => {
    assert.ok(VAULT_KIDS_PLANS_PATH.includes('resource=kids-plans'));
    const url = buildVaultKidsPlansUrl('https://vault.example', {
      year: '2026',
      classroom: 'Toddlers',
    });
    assert.equal(
      url,
      'https://vault.example/api/vault?resource=kids-plans&year=2026&classroom=Toddlers'
    );
  });
});

describe('kids-plans bridge + UI', () => {
  it('exposes GET-only bridge', () => {
    assert.ok(existsSync(join(root, 'api/kids-plans.js')));
    const src = read('api/kids-plans.js');
    assert.ok(src.includes('buildVaultKidsPlansUrl'));
    assert.ok(src.includes("method !== 'GET'"));
    assert.equal(src.includes('method === \'POST\''), false);
    assert.equal(src.includes('DELETE'), false);
  });

  it('wires vite middleware and App route', () => {
    assert.ok(read('vite.config.ts').includes("'/api/kids-plans'"));
    const app = read('App.tsx');
    assert.ok(app.includes('path="/kids-plans"'));
    assert.ok(app.includes('MemberKidsPlansPage'));
    assert.ok(app.includes('requireAccess="approved_member"'));
  });

  it('nav entries on More and Account', () => {
    assert.ok(read('pages/MemberMore.tsx').includes("to: '/kids-plans'"));
    assert.ok(read('pages/MemberAccount.tsx').includes('to="/kids-plans"'));
  });

  it('page is read-only Open link (no upload UI)', () => {
    const page = read('pages/MemberKidsPlans.tsx');
    assert.ok(page.includes('fetchKidsPlans'));
    assert.ok(page.includes('Open'));
    assert.equal(page.includes('canDelete'), false);
    assert.equal(page.includes('type="file"'), false);
    assert.equal(page.includes("method: 'POST'"), false);
    assert.equal(page.includes("method: 'DELETE'"), false);
  });

  it('client never posts/deletes', () => {
    const client = read('lib/kidsPlansClient.ts');
    assert.ok(client.includes('/api/kids-plans'));
    assert.ok(client.includes("method: 'GET'"));
    assert.equal(client.includes("method: 'POST'"), false);
    assert.equal(client.includes("method: 'DELETE'"), false);
  });

  it('API handler count includes kids-plans', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.ok(handlers.includes('kids-plans.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
  });
});

describe('ECOSYSTEM kids plans notes', () => {
  it('documents Connect kids-plans bridge and Vault upload ownership', () => {
    const docs = read('docs/ECOSYSTEM.md');
    assert.ok(docs.includes('/api/kids-plans'));
    assert.ok(/Kids Plans/i.test(docs));
    assert.ok(/create_kids_ministry_plans|kids_ministry_plans/i.test(docs));
    assert.ok(/upload stays in Vault|Uploads stay in Vault/i.test(docs));
  });
});
