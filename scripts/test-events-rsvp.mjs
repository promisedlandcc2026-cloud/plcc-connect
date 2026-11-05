/**
 * Smoke: event normalize respects Vault rsvp_enabled; no invented RSVP when off.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Assert source contracts (no TS transpile in smoke).
const eventsSrc = readFileSync(join(root, 'lib/events.ts'), 'utf8');
const detailSrc = readFileSync(join(root, 'components/EventDetailModule.tsx'), 'utf8');
const upcomingSrc = readFileSync(join(root, 'components/UpcomingEvents.tsx'), 'utf8');
const typesSrc = readFileSync(join(root, 'types.ts'), 'utf8');

assert.match(typesSrc, /rsvp_enabled\?: boolean/);
assert.match(eventsSrc, /resolveRsvpEnabled/);
assert.match(eventsSrc, /vaultEventRsvpUrl/);
assert.match(eventsSrc, /rsvp_enabled === false/);
assert.match(eventsSrc, /rsvp_enabled: rsvpEnabled/);
assert.equal(
  /rsvp_url: rsvpUrl[\s\S]*isCookoutEvent\(raw\)\s*\?\s*FELLOWSHIP_COOKOUT_RSVP_URL/.test(eventsSrc),
  false,
  'must not invent cookout RSVP URL when rsvp_enabled is off'
);

assert.match(detailSrc, /object-contain/);
assert.match(detailSrc, /showRsvp/);
assert.match(detailSrc, /event\.rsvp_enabled && event\.rsvp_url/);
assert.equal(detailSrc.includes('event_registrations'), false, 'must not invent Connect RSVP inserts');
assert.equal(detailSrc.includes('Complete RSVP'), false, 'inline RSVP form must be gone');
assert.equal(detailSrc.includes('object-cover'), false, 'detail flyer must not crop with object-cover');

assert.match(upcomingSrc, /event\.rsvp_enabled && event\.rsvp_url/);
assert.equal(
  /RSVP<\/div>\s*\)\s*:\s*\(\s*<div[\s\S]*RSVP/.test(upcomingSrc) ||
    upcomingSrc.includes('group-hover:bg-burgundy group-hover:text-white transition-all shrink-0">\n                        RSVP'),
  false,
  'list must not show fake RSVP chip when Vault toggle is off'
);

console.log('ok: events rsvp + flyer contracts');
