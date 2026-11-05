/**
 * Live Huddle Play Music (mirrors PLCC Canaan, Oct 2026).
 * Run: node --test scripts/test-huddle-music.mjs
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let m;
before(async () => {
  const out = await build({
    entryPoints: [join(root, 'lib/huddleMusic.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
  });
  m = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
});

describe('huddle music helpers', () => {
  it('uses the same track name as the Vault so both apps see the music', () => {
    assert.equal(m.HUDDLE_MUSIC_TRACK_NAME, 'awc-huddle-music');
    const vaultPath = join(root, '..', 'awc-vault', 'api', '_utils', 'huddleMusic.ts');
    if (existsSync(vaultPath)) {
      assert.match(readFileSync(vaultPath, 'utf8'), /HUDDLE_MUSIC_TRACK_NAME = 'awc-huddle-music'/);
    }
  });

  it('only moderators and hosts can control music', () => {
    assert.equal(m.canControlHuddleMusic(true), true);
    assert.equal(m.canControlHuddleMusic(false), false);
  });

  it('recognizes the music publication by track name', () => {
    assert.equal(m.isHuddleMusicPublication({ trackName: 'awc-huddle-music' }), true);
    assert.equal(m.isHuddleMusicPublication({ trackName: 'microphone' }), false);
    assert.equal(m.isHuddleMusicPublication(null), false);
    assert.equal(m.roomHasHuddleMusic([{ trackName: 'mic' }, { trackName: 'awc-huddle-music' }]), true);
    assert.equal(m.roomHasHuddleMusic([{ trackName: 'mic' }]), false);
  });

  it('labels the button for each state', () => {
    assert.equal(m.huddleMusicButtonLabel(false), 'Play Music');
    assert.equal(m.huddleMusicButtonLabel(true), 'Stop Music');
    assert.equal(m.huddleMusicButtonLabel(false, true), 'Music On');
  });

  it('keeps volume in range', () => {
    assert.equal(m.clampHuddleMusicVolume(5), m.HUDDLE_MUSIC_MAX_VOLUME);
    assert.equal(m.clampHuddleMusicVolume(0), m.HUDDLE_MUSIC_MIN_VOLUME);
    assert.equal(m.clampHuddleMusicVolume('x'), m.HUDDLE_MUSIC_DEFAULT_VOLUME);
  });

  it('gives a separate audio key per track so voice and music both play', () => {
    const voice = m.huddleRemoteAudioKey('host-1', 'TR_mic');
    const music = m.huddleRemoteAudioKey('host-1', 'TR_music');
    assert.notEqual(voice, music);
    assert.equal(m.huddleRemoteAudioKey('host-1', ''), 'host-1');
  });

  it('turns failures into plain messages', () => {
    assert.equal(m.formatHuddleMusicError(new Error('404 failed to load')), 'Waiting music file is not installed.');
    assert.equal(m.formatHuddleMusicError(new Error('captureStream not supported')), 'Background music is not available in this browser.');
    assert.equal(m.formatHuddleMusicError(new Error('Music is already playing.')), 'Music is already playing.');
  });
});

describe('huddle UI wiring', () => {
  const ui = read('components/community/ConnectVoiceHuddle.tsx');

  it('ships the music file', () => {
    const p = join(root, 'public/huddle/waiting.mp3');
    assert.ok(existsSync(p));
    assert.ok(statSync(p).size > 1000);
  });

  it('shows Play Music only to moderators, never in Prayer Watch', () => {
    assert.match(ui, /canPlayHuddleMusic = canControlHuddleMusic\(canModerate\) && !prayerWatch/);
    assert.match(ui, /\{canPlayHuddleMusic \? \(/);
    assert.match(ui, /data-huddle-music-control="true"/);
  });

  it('shows everyone when music is playing', () => {
    assert.match(ui, /data-huddle-music-active="true"/);
  });

  it('publishes music under the shared track name', () => {
    assert.match(ui, /name: HUDDLE_MUSIC_TRACK_NAME/);
  });

  it('keys remote audio per track, not per person', () => {
    assert.match(ui, /attachRemoteAudio\(huddleRemoteAudioKey\(participant\.identity, pub\?\.trackSid\)/);
    assert.doesNotMatch(ui, /attachRemoteAudio\(p\.identity,/);
    assert.doesNotMatch(ui, /attachRemoteAudio\(participant\.identity,/);
  });

  it('stops music before leaving the room', () => {
    assert.match(ui, /const disconnectRoom = useCallback\(async \(\) => \{\s*\/\/[^\n]*\n\s*await stopHuddleMusic\(\);/);
  });
});
