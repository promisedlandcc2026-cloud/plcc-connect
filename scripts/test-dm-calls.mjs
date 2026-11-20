/**
 * Private calls in DMs (Nov 20 2026): WhatsApp-style voice and video calls for every member.
 * Same feature as PLCC Ka Link. Run: node --test scripts/test-dm-calls.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('Tribes private calls', () => {
  it('the bridge passes dm-call through to Canaan with a fixed shape', async () => {
    const bridge = read('api/_community/community-chat.js');
    assert.match(bridge, /'dm-call',\n  'huddle-moderate'/);
    assert.match(bridge, /\['inbox', 'pending', 'ring', 'join', 'decline', 'end', 'status'\]\.includes\(action\)/);
    const { buildVaultCommunityChatIssuesUrl } = await import('../api/_utils/vaultOrigin.js');
    assert.match(buildVaultCommunityChatIssuesUrl('https://canaan.example', 'dm-call'), /subResource=dm-call$/);
  });

  it('DM headers show voice and video call buttons', () => {
    const room = read('pages/CommunityChatRoom.tsx');
    assert.match(room, /\{isDm && dmCall \? \(/);
    assert.match(room, /data-dm-call="voice"/);
    assert.match(room, /data-dm-call="video"/);
    assert.match(room, /wantsAnswerFromUrl\(location\.search\)/);
  });

  it('the call provider wraps the app and rings anywhere', () => {
    assert.match(read('App.tsx'), /<DmCallProvider>[\s\S]*<AppShell[\s\S]*<\/DmCallProvider>/);
    const ctx = read('context/DmCallContext.tsx');
    assert.match(ctx, /\.on\('broadcast', \{ event: 'ring' \}/);
    assert.match(ctx, /startRingtone\(\)/);
  });

  it('video is for everyone, one call at a time, never on top of a prayer room', () => {
    const ctx = read('context/DmCallContext.tsx');
    assert.match(ctx, /if \(pass\.video\) \{\s*try \{\s*await room\.localParticipant\.setCameraEnabled\(true/);
    assert.match(ctx, /isCallActive\(\) && !ownsCallRef\.current/);
    assert.match(ctx, /Leave the prayer room first, then call\./);
    assert.match(ctx, /busy on another call/);
  });

  it('call alerts ring on the phone only when the app is not open', () => {
    const sw = read('public/sw.js');
    assert.match(sw, /startsWith\('call:'\)/);
    assert.match(sw, /requireInteraction: true/);
  });

  it('Ka Link and Tribes share the same call screen and helpers', () => {
    for (const f of ['lib/dmCall.ts', 'lib/callTone.ts', 'components/call/DmCallScreen.tsx']) {
      assert.ok(read(f).length > 500, f);
    }
  });

  it('a missed ring ping still rings: retries the call topic and checks for a ringing call', () => {
    const ctx = read('context/DmCallContext.tsx');
    assert.match(ctx, /retryLater\(\)/);
    assert.match(ctx, /status === 'CHANNEL_ERROR' \|\| status === 'TIMED_OUT' \|\| status === 'CLOSED'/);
    assert.match(ctx, /fetchPendingCall\(\)/);
    assert.match(ctx, /addEventListener\('visibilitychange', onVisible\)/);
    assert.match(ctx, /setInterval\(\(\) => void checkPending\(\), 20_000\)/);
  });
});
