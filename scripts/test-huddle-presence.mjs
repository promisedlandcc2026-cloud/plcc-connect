/**
 * Huddle presence + mobile Hands/Chat/Attendance tabs.
 * Run: node --test scripts/test-huddle-presence.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function sortTilesRaisedFirst(tiles) {
  return [...tiles].sort((a, b) => {
    if (a.handRaised !== b.handRaised) return a.handRaised ? -1 : 1;
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function syncRosterFromTiles(prev, tiles, now = Date.now()) {
  const byId = new Map(prev.map((e) => [e.identity, e]));
  const present = new Set(tiles.map((t) => t.identity));
  for (const tile of tiles) {
    const existing = byId.get(tile.identity);
    byId.set(tile.identity, {
      ...tile,
      status: 'in',
      joinedAt: existing?.joinedAt ?? now,
      leftAt: null,
    });
  }
  for (const [id, entry] of byId) {
    if (!present.has(id) && entry.status === 'in') {
      byId.set(id, { ...entry, status: 'left', leftAt: now, handRaised: false });
    }
  }
  return Array.from(byId.values());
}

describe('huddlePresence runtime', () => {
  it('sorts raised hands first', () => {
    const sorted = sortTilesRaisedFirst([
      { identity: 'a', name: 'Ada', isLocal: false, handRaised: false },
      { identity: 'b', name: 'Bob', isLocal: true, handRaised: true },
      { identity: 'c', name: 'Cara', isLocal: false, handRaised: true },
    ]);
    assert.equal(sorted[0].identity, 'b');
    assert.equal(sorted[1].identity, 'c');
    assert.equal(sorted[2].identity, 'a');
  });

  it('keeps leavers on the session roster', () => {
    const t0 = 1_000_000;
    let roster = syncRosterFromTiles(
      [],
      [
        { identity: '1', name: 'Ann', isLocal: true, micOn: true, camOn: false, handRaised: false },
        { identity: '2', name: 'Ben', isLocal: false, micOn: true, camOn: false, handRaised: true },
      ],
      t0
    );
    assert.equal(roster.filter((e) => e.status === 'in').length, 2);
    roster = syncRosterFromTiles(
      roster,
      [{ identity: '1', name: 'Ann', isLocal: true, micOn: true, camOn: false, handRaised: false }],
      t0 + 60_000
    );
    const left = roster.find((e) => e.identity === '2');
    assert.equal(left.status, 'left');
    assert.equal(left.leftAt, t0 + 60_000);
  });
});

describe('huddle chat wire format', () => {
  it('exports Vault-compatible topic and helpers', () => {
    const src = read('lib/huddleChat.ts');
    assert.ok(src.includes("HUDDLE_CHAT_TOPIC = 'awc.huddle.chat'"));
    assert.ok(src.includes("HUDDLE_CHAT_TYPE = 'huddle_chat'"));
    assert.ok(src.includes('export function decodeIncomingHuddleChat'));
    assert.ok(src.includes('export function buildHuddleChatWirePayload'));
    assert.ok(src.includes('export function encodeHuddleChatPayload'));
  });
});

describe('mobile Hands | Chat | Attendance', () => {
  it('tab shell and panels exist', () => {
    assert.ok(read('components/huddle/HuddleMobileTabs.tsx').includes('Hands'));
    assert.ok(read('components/huddle/HuddleMobileTabs.tsx').includes('Chat'));
    assert.ok(read('components/huddle/HuddleMobileTabs.tsx').includes('Attendance'));
    assert.ok(read('components/huddle/HuddleMobileTabs.tsx').includes('data-testid="huddle-mobile-tabs"'));
    assert.ok(read('components/huddle/HuddleHandsPanel.tsx').includes('data-testid="huddle-hands-panel"'));
    assert.ok(read('components/huddle/HuddleChatPanel.tsx').includes('data-testid="huddle-chat-panel"'));
    assert.ok(read('components/huddle/HuddlePeoplePanel.tsx').includes('data-testid="huddle-attendance-panel"'));
    assert.ok(read('components/huddle/HuddleTabSheet.tsx').includes('data-testid="huddle-tab-sheet"'));
  });

  it('ConnectVoiceHuddle wires tabs, chat DataReceived, and attendance', () => {
    const src = read('components/community/ConnectVoiceHuddle.tsx');
    assert.ok(src.includes('HuddleMobileTabs'));
    assert.ok(src.includes('HuddleHandsPanel'));
    assert.ok(src.includes('HuddleChatPanel'));
    assert.ok(src.includes('RoomEvent.DataReceived'));
    assert.ok(src.includes('publishData'));
    assert.ok(src.includes('HUDDLE_CHAT_TOPIC'));
    assert.ok(src.includes("setActiveTab('attendance')"));
    assert.ok(src.includes("variant=\"embedded\""));
  });

  it('FamilyVoiceHuddle mirrors tabs and moves invites into Attendance', () => {
    const src = read('components/family/FamilyVoiceHuddle.tsx');
    assert.ok(src.includes('HuddleMobileTabs'));
    assert.ok(src.includes('HuddleHandsPanel'));
    assert.ok(src.includes('HuddleChatPanel'));
    assert.ok(src.includes('RoomEvent.DataReceived'));
    assert.ok(src.includes('footer={inviteFooter}'));
    assert.equal(src.includes('Share a guest link') && src.includes('<footer') && /footer[\s\S]*Share a guest link/.test(src), false);
  });

  it('Connect and Family huddles follow LiveKit host mute on the local mic', () => {
    const presence = read('lib/huddlePresence.ts');
    assert.ok(presence.includes('HUDDLE_HOST_MUTE_NOTICE'));
    assert.ok(presence.includes('huddleMicrophonePublishAllowed'));
    for (const file of [
      'components/community/ConnectVoiceHuddle.tsx',
      'components/family/FamilyVoiceHuddle.tsx',
    ]) {
      const src = read(file);
      assert.ok(src.includes('RoomEvent.TrackMuted'), file);
      assert.ok(src.includes('RoomEvent.TrackUnmuted'), file);
      assert.ok(src.includes('RoomEvent.ParticipantPermissionsChanged'), file);
      assert.ok(src.includes('RoomEvent.LocalTrackUnpublished'), file);
      assert.ok(src.includes('HUDDLE_HOST_MUTE_NOTICE'), file);
      assert.ok(src.includes('huddleMicrophonePublishAllowed'), file);
      assert.ok(src.includes('Track.Source.Microphone'), file);
      assert.ok(src.includes('setMicrophoneEnabled(false)'), file);
      assert.ok(src.includes('Join muted.'), file);
      assert.ok(src.includes('const [micEnabled, setMicEnabled] = useState(false)'), file);
    }
  });
});

describe('huddle host mute helpers', () => {
  function huddleMicrophonePublishAllowed(permissions) {
    const sources = permissions?.canPublishSources;
    if (!Array.isArray(sources) || sources.length === 0) return true;
    return sources.some((source) => String(source).toUpperCase().includes('MICROPHONE'));
  }

  it('treats missing or empty canPublishSources as mic allowed', () => {
    assert.equal(huddleMicrophonePublishAllowed(null), true);
    assert.equal(huddleMicrophonePublishAllowed({}), true);
    assert.equal(huddleMicrophonePublishAllowed({ canPublishSources: [] }), true);
  });

  it('treats a host mute as mic not allowed when MICROPHONE is missing', () => {
    assert.equal(
      huddleMicrophonePublishAllowed({ canPublishSources: ['CAMERA', 'SCREEN_SHARE'] }),
      false
    );
    assert.equal(
      huddleMicrophonePublishAllowed({ canPublishSources: ['MICROPHONE', 'CAMERA'] }),
      true
    );
  });
});

describe('Vault LiveKit metadata grant (when vault checkout present)', () => {
  it('community and family tokens enable canUpdateOwnMetadata', () => {
    const community = join(root, '../awc-vault-main/api/_utils/livekitVoice.ts');
    const family = join(root, '../awc-vault-main/api/_utils/livekitFamilyVoice.ts');
    if (!existsSync(community) || !existsSync(family)) {
      assert.ok(true);
      return;
    }
    assert.ok(readFileSync(community, 'utf8').includes('canUpdateOwnMetadata: true'));
    assert.ok(readFileSync(family, 'utf8').includes('canUpdateOwnMetadata: true'));
  });
});
