/**
 * Holiday RSVPs (Thanksgiving / Marrieds Dinner) + Phase 1 Home "Next up".
 * Run: node --test scripts/test-holiday-rsvp.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

async function load(entry) {
  const out = await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

const VAULT = 'https://plcc-opal.vercel.app';
const THANKSGIVING = '86ac9498-ee56-4c6a-baae-079832b0ea73';
const MARRIEDS = 'a1b2c3d4-e5f6-4789-a012-202612121800';

describe('holiday RSVP config', () => {
  it('matches the Vault Fellowship Event Kit ids and close times', () => {
    const vaultKit = '../awc-vault/api/_utils/fellowshipEventConfig.ts';
    let kit = null;
    try {
      kit = readFileSync(join(root, vaultKit), 'utf8');
    } catch {
      /* Vault not checked out next to Connect — skip the cross-check */
    }
    const src = read('lib/holidayRsvps.ts');
    assert.ok(src.includes(THANKSGIVING));
    assert.ok(src.includes("rsvpCloseAt: '2026-12-04T23:59:00-05:00'"));
    assert.ok(src.includes(MARRIEDS));
    assert.ok(src.includes("rsvpCloseAt: '2026-12-05T23:59:00-05:00'"));
    if (kit) {
      assert.ok(kit.includes(THANKSGIVING));
      assert.ok(kit.includes("rsvpCloseAt: '2026-12-04T23:59:00-05:00'"));
      assert.ok(kit.includes("rsvpCloseAt: '2026-12-05T23:59:00-05:00'"));
    }
  });

  it('links use Vault hash routes', async () => {
    const h = await load('lib/holidayRsvps.ts');
    assert.equal(h.vaultEventRsvpUrl(THANKSGIVING), `${VAULT}/#/events/${THANKSGIVING}/rsvp`);
    assert.equal(h.normalizeVaultRsvpLink(`${VAULT}/events/x/rsvp`), `${VAULT}/#/events/x/rsvp`);
    assert.equal(h.normalizeVaultRsvpLink(`${VAULT}/#/events/x/rsvp`), `${VAULT}/#/events/x/rsvp`);
    assert.equal(h.normalizeVaultRsvpLink('/#/thanksgiving-rsvp'), `${VAULT}/#/thanksgiving-rsvp`);
    assert.equal(h.normalizeVaultRsvpLink('https://forms.example.com/x'), 'https://forms.example.com/x');
  });

  it('stops featuring a holiday the Vault deleted, and keeps the rest', async () => {
    const h = await load('lib/holidayRsvps.ts');
    const mid = new Date('2026-10-15T09:00:00-04:00');
    assert.equal(h.featuredHolidayRsvp(mid, { removedIds: new Set([THANKSGIVING]) }), null);
    assert.equal(h.featuredHolidayRsvp(mid, { removedIds: new Set([MARRIEDS]) }).eventId, THANKSGIVING);
    assert.equal(h.featuredHolidayRsvp(mid, { removedIds: new Set() }).eventId, THANKSGIVING);
    const later = new Date('2026-12-05T00:30:00-05:00');
    assert.equal(h.featuredHolidayRsvp(later, { removedIds: new Set([MARRIEDS]) }), null);
  });

  it('features Thanksgiving until RSVP closes, then the Marrieds Dinner', async () => {
    const h = await load('lib/holidayRsvps.ts');
    assert.equal(h.featuredHolidayRsvp(new Date('2026-09-20T12:00:00-04:00')), null);
    assert.equal(h.featuredHolidayRsvp(new Date('2026-10-15T09:00:00-04:00')).eventId, THANKSGIVING);
    assert.equal(h.featuredHolidayRsvp(new Date('2026-11-16T23:00:00-05:00')).eventId, THANKSGIVING);
    // Thanksgiving moved to Dec 6 (RSVP closes Dec 4), so it stays featured past Nov 17.
    assert.equal(h.featuredHolidayRsvp(new Date('2026-11-17T00:30:00-05:00')).eventId, THANKSGIVING);
    assert.equal(h.featuredHolidayRsvp(new Date('2026-12-04T23:00:00-05:00')).eventId, THANKSGIVING);
    assert.equal(h.featuredHolidayRsvp(new Date('2026-12-05T00:30:00-05:00')).eventId, MARRIEDS);
    assert.equal(h.featuredHolidayRsvp(new Date('2026-12-06T08:00:00-05:00')), null);
    assert.equal(h.formatRsvpBy('2026-11-16T23:59:00-05:00'), 'Mon, Nov 16');
    assert.equal(h.daysLeftToRsvp('2026-11-16T23:59:00-05:00', new Date('2026-11-16T09:00:00-05:00')), 0);
  });
});

describe('calendar events', () => {
  it('Thanksgiving gets RSVP, a hash link, member copy, and a close date', async () => {
    const ev = await load('lib/events.ts');
    const e = ev.normalizeEvent({
      id: THANKSGIVING,
      name: 'Join us at PLCC Table of Thanksgiving 2026',
      date: '2026-11-22',
      time: '2:00 PM',
      location: '2nd Floor Sanctuary',
      description: 'PLCC Table of Thanksgiving. Sign up at /#/thanksgiving-rsvp',
      starts_at: '2026-11-22T19:00:00+00:00',
    });
    assert.equal(e.rsvp_enabled, true);
    assert.equal(e.rsvp_url, `${VAULT}/#/events/${THANKSGIVING}/rsvp`);
    assert.equal(e.description.includes('/#/'), false);
    assert.equal(e.rsvp_close_at, '2026-12-04T23:59:00-05:00');
  });

  it('Vault can still switch RSVP off, and cookout link uses the hash route', async () => {
    const ev = await load('lib/events.ts');
    const off = ev.normalizeEvent({ id: THANKSGIVING, name: 'T', date: '2026-11-22', rsvp_enabled: false });
    assert.equal(off.rsvp_enabled, false);
    assert.equal(off.rsvp_url, undefined);
    assert.equal(ev.FELLOWSHIP_COOKOUT_RSVP_URL, `${VAULT}/#/fellowship-cookout`);
    const plain = ev.normalizeEvent({ id: 'x', name: 'Bible Study', date: '2026-10-21' });
    assert.equal(plain.rsvp_enabled, false);
  });

  it('RSVP button hides after close', () => {
    assert.match(read('components/EventDetailModule.tsx'), /RSVP closed/);
    assert.match(read('components/EventDetailModule.tsx'), /RSVP by \{formatRsvpBy/);
    assert.match(read('components/UpcomingEvents.tsx'), /!isRsvpClosed\(event\.rsvp_close_at\)/);
  });
});

describe('home', () => {
  it('Next up prefers happening-now, then next event, then Sunday service', async () => {
    const n = await load('lib/nextUp.ts');
    const now = new Date('2026-10-18T10:30:00-04:00');
    const events = [
      { id: 'a', title: 'Sunday Worship', starts_at: '2026-10-18T10:00:00-04:00' },
      { id: 'b', title: 'Bible Study', starts_at: '2026-10-21T19:00:00-04:00' },
      { id: 'c', title: 'Old', starts_at: '2026-10-11T10:00:00-04:00' },
    ];
    const live = n.pickNextUp(events, now);
    assert.equal(live.event.id, 'a');
    assert.equal(live.happeningNow, true);
    const later = n.pickNextUp(events, new Date('2026-10-18T13:00:00-04:00'));
    assert.equal(later.event.id, 'b');
    assert.equal(later.happeningNow, false);
    const none = n.pickNextUp([], now);
    assert.equal(none.kind, 'fallback');
    assert.match(none.title, /Sunday/);
    assert.match(n.directionsUrl(), /google\.com\/maps\/dir\/.*School/);
  });

  it('holiday card is on both member and visitor Home', () => {
    assert.match(read('components/member/MemberHome.tsx'), /<HolidayRsvpCard \/>/);
    assert.match(read('components/Home.tsx'), /<HolidayRsvpCard \/>/);
    assert.match(read('components/home/HolidayRsvpCard.tsx'), /vaultEventRsvpUrl/);
  });
});
