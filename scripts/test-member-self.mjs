/**
 * Focused Phase 1.5 tests — Node built-in test runner (no new dependencies).
 * Run: node --test scripts/test-member-self.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_NOTICE_VERSION,
  approvalStatusFromRole,
  buildMergedPrefsForAction,
  parseBearerAuthorization,
  parseMemberSelfPatchCommand,
  parseVaultSelfUserResponse,
  parseVaultUserPatchResponse,
  sanitizeAvatarUrl,
  sanitizeMediaNotice,
  sanitizeVaultUserRow,
} from '../api/_utils/memberIdentity.js';
import {
  buildVaultSelfUserUrl,
  buildVaultUsersPatchUrl,
  parseVaultApiOrigin,
  VAULT_SELF_USER_PATH,
  VAULT_USERS_PATCH_PATH,
} from '../api/_utils/vaultOrigin.js';

describe('parseVaultApiOrigin', () => {
  it('accepts https origin', () => {
    const r = parseVaultApiOrigin('https://plcc-opal.vercel.app/');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.origin, 'https://plcc-opal.vercel.app');
  });

  it('rejects credentials, query, fragment, path', () => {
    assert.equal(parseVaultApiOrigin('https://user:pass@host').ok, false);
    assert.equal(parseVaultApiOrigin('https://host?x=1').ok, false);
    assert.equal(parseVaultApiOrigin('https://host#/x').ok, false);
    assert.equal(parseVaultApiOrigin('https://host/api').ok, false);
  });

  it('rejects http in production mode', () => {
    assert.equal(parseVaultApiOrigin('http://plcc-opal.vercel.app').ok, false);
  });

  it('allows http localhost when allowHttpLocal', () => {
    const r = parseVaultApiOrigin('http://localhost:3001', { allowHttpLocal: true });
    assert.equal(r.ok, true);
  });

  it('rejects missing', () => {
    assert.equal(parseVaultApiOrigin('').ok, false);
    assert.equal(parseVaultApiOrigin(undefined).ok, false);
  });
});

describe('buildVaultSelfUserUrl', () => {
  it('uses fixed path only', () => {
    assert.equal(
      buildVaultSelfUserUrl('https://example.com'),
      `https://example.com${VAULT_SELF_USER_PATH}`
    );
    assert.ok(VAULT_SELF_USER_PATH.includes('resource=users'));
    assert.ok(VAULT_SELF_USER_PATH.includes('self=true'));
  });
});

describe('buildVaultUsersPatchUrl', () => {
  it('uses fixed users path without self query', () => {
    assert.equal(
      buildVaultUsersPatchUrl('https://example.com'),
      `https://example.com${VAULT_USERS_PATCH_PATH}`
    );
    assert.ok(VAULT_USERS_PATCH_PATH.includes('resource=users'));
    assert.equal(VAULT_USERS_PATCH_PATH.includes('self='), false);
  });
});

describe('parseBearerAuthorization', () => {
  it('accepts JWT-shaped bearer', () => {
    const r = parseBearerAuthorization('Bearer aaa.bbb.ccc');
    assert.equal(r.ok, true);
  });

  it('rejects missing or malformed', () => {
    assert.equal(parseBearerAuthorization(undefined).ok, false);
    assert.equal(parseBearerAuthorization('Basic x').ok, false);
    assert.equal(parseBearerAuthorization('Bearer active').ok, false);
    assert.equal(parseBearerAuthorization('Bearer not-a-jwt').ok, false);
  });
});

describe('approvalStatusFromRole', () => {
  it('maps PENDING and unknown to pending', () => {
    assert.equal(approvalStatusFromRole('PENDING'), 'pending');
    assert.equal(approvalStatusFromRole(''), 'pending');
    assert.equal(approvalStatusFromRole('TOTALLY_FAKE'), 'pending');
  });

  it('maps approved allow-list roles', () => {
    assert.equal(approvalStatusFromRole('MEMBER'), 'approved');
    assert.equal(approvalStatusFromRole('PASTOR'), 'approved');
    assert.equal(approvalStatusFromRole('member'), 'approved');
  });
});

describe('sanitizeVaultUserRow', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test Member',
    email: 'member@example.com',
    avatar_url: 'https://cdn.example.com/a.png',
    role: 'MEMBER',
    password_hash: 'SECRET',
    notification_prefs: { push: true },
  };

  it('keeps only safe fields', () => {
    const r = sanitizeVaultUserRow(base);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(Object.keys(r.member).sort(), [
      'approvalStatus',
      'avatarUrl',
      'email',
      'id',
      'mediaNotice',
      'name',
      'role',
    ]);
    assert.equal(r.member.approvalStatus, 'approved');
    assert.equal(r.member.mediaNotice, null);
    assert.equal('password_hash' in r.member, false);
    assert.equal('notification_prefs' in r.member, false);
  });

  it('PENDING stays pending', () => {
    const r = sanitizeVaultUserRow({ ...base, role: 'PENDING' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.member.approvalStatus, 'pending');
  });

  it('exposes mediaNotice ack only', () => {
    const r = sanitizeVaultUserRow({
      ...base,
      notification_prefs: {
        push: true,
        mediaNotice: {
          acknowledgedAt: '2026-01-01T00:00:00.000Z',
          version: MEDIA_NOTICE_VERSION,
        },
      },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.member.mediaNotice, {
      acknowledgedAt: '2026-01-01T00:00:00.000Z',
      version: MEDIA_NOTICE_VERSION,
    });
  });

  it('rejects bad id', () => {
    assert.equal(sanitizeVaultUserRow({ ...base, id: 'nope' }).ok, false);
  });
});

describe('sanitizeMediaNotice', () => {
  it('returns null without acknowledgedAt', () => {
    assert.equal(sanitizeMediaNotice({ mediaNotice: { version: 'x' } }), null);
    assert.equal(sanitizeMediaNotice(null), null);
  });
});

describe('parseMemberSelfPatchCommand', () => {
  it('accepts allowed actions only', () => {
    assert.deepEqual(parseMemberSelfPatchCommand({ action: 'complete_onboarding' }), {
      ok: true,
      action: 'complete_onboarding',
    });
    assert.deepEqual(parseMemberSelfPatchCommand({ action: 'acknowledge_media_notice' }), {
      ok: true,
      action: 'acknowledge_media_notice',
    });
  });

  it('rejects unknown action and extra fields', () => {
    assert.equal(parseMemberSelfPatchCommand({ action: 'promote_admin' }).ok, false);
    assert.equal(
      parseMemberSelfPatchCommand({ action: 'complete_onboarding', id: 'x' }).reason,
      'extra_fields'
    );
  });
});

describe('buildMergedPrefsForAction', () => {
  it('merges onboarding without wiping other prefs', () => {
    const merged = buildMergedPrefsForAction(
      { push: true, onboarding: { path: 'new' } },
      'complete_onboarding',
      '2026-02-01T12:00:00.000Z'
    );
    assert.equal(merged.push, true);
    assert.deepEqual(merged.onboarding, {
      path: 'connect',
      completedAt: '2026-02-01T12:00:00.000Z',
    });
  });

  it('sets mediaNotice version', () => {
    const merged = buildMergedPrefsForAction({}, 'acknowledge_media_notice', '2026-03-01T00:00:00.000Z');
    assert.deepEqual(merged.mediaNotice, {
      acknowledgedAt: '2026-03-01T00:00:00.000Z',
      version: MEDIA_NOTICE_VERSION,
    });
  });
});

describe('parseVaultUserPatchResponse', () => {
  it('maps user row', () => {
    const r = parseVaultUserPatchResponse({
      ok: true,
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'A',
        email: 'a@b.co',
        avatar_url: null,
        role: 'MEMBER',
        notification_prefs: {
          mediaNotice: {
            acknowledgedAt: '2026-01-01T00:00:00.000Z',
            version: MEDIA_NOTICE_VERSION,
          },
        },
      },
    });
    assert.equal(r.kind, 'member');
    if (r.kind === 'member') {
      assert.equal(r.member.approvalStatus, 'approved');
      assert.ok(r.member.mediaNotice);
    }
  });
});

describe('sanitizeAvatarUrl', () => {
  it('allows https and rejects javascript', () => {
    assert.ok(sanitizeAvatarUrl('https://x.com/a.png'));
    assert.equal(sanitizeAvatarUrl('javascript:alert(1)'), null);
  });
});

describe('parseVaultSelfUserResponse', () => {
  it('maps empty users to missing', () => {
    assert.equal(parseVaultSelfUserResponse({ ok: true, users: [] }).kind, 'missing');
  });

  it('maps valid user', () => {
    const r = parseVaultSelfUserResponse({
      ok: true,
      users: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'A',
          email: 'a@b.co',
          avatar_url: null,
          role: 'MEMBER',
        },
      ],
    });
    assert.equal(r.kind, 'member');
  });

  it('rejects invalid JSON shape', () => {
    assert.equal(parseVaultSelfUserResponse(null).kind, 'invalid');
    assert.equal(parseVaultSelfUserResponse({ ok: true }).kind, 'invalid');
  });
});

describe('memberAccessFromIdentity (inline)', () => {
  // Mirror lib/authTypes.ts logic without TS import
  function memberAccessFromIdentity(opts) {
    if (!opts.isAuthenticated) return 'visitor';
    if (opts.identityLoading && !opts.identity) return 'authenticated_unverified';
    if (opts.identity) {
      return opts.identity.approvalStatus === 'approved' ? 'approved_member' : 'pending';
    }
    if (opts.identityErrorCode === 'identity_missing') return 'identity_missing';
    if (opts.identityErrorCode) return 'identity_unavailable';
    return 'authenticated_unverified';
  }

  it('visitor makes no identity assumption', () => {
    assert.equal(
      memberAccessFromIdentity({
        isAuthenticated: false,
        identityLoading: false,
        identity: null,
        identityErrorCode: null,
      }),
      'visitor'
    );
  });

  it('maps approved and pending', () => {
    assert.equal(
      memberAccessFromIdentity({
        isAuthenticated: true,
        identityLoading: false,
        identity: { approvalStatus: 'approved' },
        identityErrorCode: null,
      }),
      'approved_member'
    );
    assert.equal(
      memberAccessFromIdentity({
        isAuthenticated: true,
        identityLoading: false,
        identity: { approvalStatus: 'pending' },
        identityErrorCode: null,
      }),
      'pending'
    );
  });

  it('maps missing and unavailable', () => {
    assert.equal(
      memberAccessFromIdentity({
        isAuthenticated: true,
        identityLoading: false,
        identity: null,
        identityErrorCode: 'identity_missing',
      }),
      'identity_missing'
    );
    assert.equal(
      memberAccessFromIdentity({
        isAuthenticated: true,
        identityLoading: false,
        identity: null,
        identityErrorCode: 'vault_unavailable',
      }),
      'identity_unavailable'
    );
  });
});
