/**
 * Phase 2.5 — Sermon Notes contracts (source + pure helpers).
 * Run: node --test scripts/test-sermon-notes.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
// The Vault repo may be checked out as awc-vault-main (local download) or
// awc-vault (git clone), or pointed to with VAULT_REPO.
const vaultRoot =
  [process.env.VAULT_REPO, join(root, '..', 'awc-vault-main'), join(root, '..', 'awc-vault')].find(
    (dir) => dir && existsSync(join(dir, 'supabase/migrations'))
  ) || null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function getYouTubeVideoId(url) {
  const match = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([^?&"'>]+)/
  );
  return match ? match[1] : null;
}

function startContextFromSermonPreview(sermon) {
  if (!sermon) return { sourceType: 'manual' };
  if (sermon.source === 'sermons' && isUuid(sermon.id)) {
    return {
      sourceType: 'sermon',
      sermonId: sermon.id.trim(),
      sermonTitle: sermon.title?.trim() || null,
      speakerName: sermon.speaker?.trim() || null,
      sermonDate: sermon.date ? String(sermon.date).slice(0, 10) : null,
      title: sermon.title?.trim() ? `Notes — ${sermon.title.trim()}` : null,
    };
  }
  if (sermon.source === 'youtube') {
    const videoId =
      sermon.youtubeVideoId?.trim() ||
      (sermon.watchUrl ? getYouTubeVideoId(sermon.watchUrl) : null);
    if (videoId) {
      const knownTitle =
        sermon.title && sermon.title !== 'Latest Message' ? sermon.title.trim() : null;
      return {
        sourceType: 'youtube',
        sourceRef: videoId,
        sermonTitle: knownTitle,
        speakerName: sermon.speaker?.trim() || null,
        sermonDate: sermon.date ? String(sermon.date).slice(0, 10) : null,
        title: knownTitle ? `Notes — ${knownTitle}` : 'Notes — Latest Message',
      };
    }
  }
  return { sourceType: 'manual' };
}

function notesNewPath(ctx) {
  if (!ctx || ctx.sourceType === 'manual') {
    return ctx?.entryType && ctx.entryType !== 'sermon' ? `/notes/new?type=${ctx.entryType}` : '/notes/new';
  }
  const params = new URLSearchParams();
  params.set('source', ctx.sourceType);
  if (ctx.sermonId && isUuid(ctx.sermonId)) params.set('sermonId', ctx.sermonId.trim());
  if (ctx.sourceRef) params.set('ref', String(ctx.sourceRef).slice(0, 500));
  if (ctx.title) params.set('title', String(ctx.title).slice(0, 200));
  if (ctx.sermonTitle) params.set('sermonTitle', String(ctx.sermonTitle).slice(0, 300));
  if (ctx.speakerName) params.set('speaker', String(ctx.speakerName).slice(0, 200));
  if (ctx.sermonDate) params.set('date', String(ctx.sermonDate).slice(0, 10));
  return `/notes/new?${params.toString()}`;
}

function parseNotesNewSearch(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawSource = String(params.get('source') || 'manual').toLowerCase();
  const sourceType =
    rawSource === 'sermon' || rawSource === 'youtube' || rawSource === 'manual'
      ? rawSource
      : 'manual';
  const sermonId = params.get('sermonId');
  const sourceRef = params.get('ref');
  if (sourceType === 'sermon' && isUuid(sermonId)) {
    return { sourceType: 'sermon', sermonId: sermonId.trim(), sourceRef: null };
  }
  if (sourceType === 'youtube' && sourceRef) {
    return { sourceType: 'youtube', sermonId: null, sourceRef: String(sourceRef) };
  }
  const rawType = params.get('type');
  const types = ['sermon', 'prayer', 'reflection', 'gratitude'];
  return { sourceType: 'manual', entryType: rawType ? (types.includes(rawType) ? rawType : 'sermon') : null };
}

function filterNotesClientSide(notes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => {
    const hay = [n.title, n.sermonTitle, n.speakerName, n.content]
      .map((s) => String(s || '').toLowerCase())
      .join('\n');
    return hay.includes(q);
  });
}

describe('Sermon Notes routes + shell', () => {
  it('gates /notes routes for approved members only', () => {
    const src = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(src.includes('path="/notes"'));
    assert.ok(src.includes('path="/notes/new"'));
    assert.ok(src.includes('path="/notes/:id"'));
    assert.ok(src.includes('MemberNotesPage'));
    assert.ok(src.includes('MemberNoteNewPage'));
    assert.ok(src.includes('MemberNoteEditPage'));
    const notesBlock = src.slice(src.indexOf('path="/notes"'));
    assert.ok(notesBlock.includes('requireAccess="approved_member"'));
  });

  it('MemberNav remains Home · Community · Events · Prayer · Me', () => {
    const src = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(src.includes("label: 'Home'"));
    assert.ok(src.includes("label: 'Community'"));
    assert.ok(src.includes("label: 'Prayer'"));
    assert.ok(src.includes("label: 'Events'"));
    assert.ok(src.includes("label: 'Me'"));
    assert.equal(src.includes("label: 'Notes'"), false);
    assert.equal(src.includes("label: 'Sunday'"), false);
  });

  it('More links to Notes & Journal index', () => {
    const src = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');
    assert.ok(src.includes("to: '/notes'"));
    assert.ok(src.includes("label: 'Notes & Journal'"));
  });

  it('PublicHome is unchanged (no private notes CTA)', () => {
    const home = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    const pub = existsSync(join(root, 'components/PublicHome.tsx'))
      ? readFileSync(join(root, 'components/PublicHome.tsx'), 'utf8')
      : '';
    assert.equal(home.includes('/notes'), false);
    assert.equal(pub.includes("to: '/notes'") || pub.includes('to="/notes"'), false);
  });
});

describe('Sunday + Home Take Notes', () => {
  it('Sunday Mode replaces Phase 2.5 placeholder with Take Notes', () => {
    const src = readFileSync(join(root, 'pages/MemberSunday.tsx'), 'utf8');
    assert.ok(src.includes('Take Notes'));
    assert.ok(src.includes('notesNewPath'));
    assert.ok(src.includes('startContextFromSermonPreview'));
    assert.equal(src.includes('Coming in Phase 2.5'), false);
  });

  it('Latest Sermon offers Take Notes with real context helper', () => {
    const src = readFileSync(join(root, 'components/member/MemberHomeSermon.tsx'), 'utf8');
    assert.ok(src.includes('Take Notes'));
    assert.ok(src.includes('startContextFromSermonPreview'));
  });
});

describe('source linking helpers', () => {
  it('links real sermon id context without inventing metadata', () => {
    const ctx = startContextFromSermonPreview({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Pentecost Power',
      speaker: 'Pastor Grace Hiire',
      date: '2026-09-13',
      source: 'sermons',
      watchUrl: null,
      youtubeVideoId: null,
    });
    assert.equal(ctx.sourceType, 'sermon');
    assert.equal(ctx.sermonId, '11111111-1111-4111-8111-111111111111');
    assert.equal(ctx.sermonTitle, 'Pentecost Power');
    assert.ok(notesNewPath(ctx).includes('source=sermon'));
    assert.ok(notesNewPath(ctx).includes('sermonId='));
  });

  it('uses YouTube video id fallback without fake speaker', () => {
    const ctx = startContextFromSermonPreview({
      id: null,
      title: 'Latest Message',
      speaker: null,
      date: null,
      source: 'youtube',
      watchUrl: 'https://www.youtube.com/watch?v=abc123XYZ01',
      youtubeVideoId: 'abc123XYZ01',
    });
    assert.equal(ctx.sourceType, 'youtube');
    assert.equal(ctx.sourceRef, 'abc123XYZ01');
    assert.equal(ctx.speakerName, null);
    assert.equal(ctx.sermonTitle, null);
  });

  it('falls back to manual when no reliable source', () => {
    assert.equal(startContextFromSermonPreview(null).sourceType, 'manual');
    assert.equal(
      startContextFromSermonPreview({
        id: null,
        title: 'x',
        speaker: null,
        date: null,
        source: 'youtube',
        watchUrl: null,
        youtubeVideoId: null,
      }).sourceType,
      'manual'
    );
  });

  it('does not invent sermon title for empty preview fields', () => {
    const ctx = startContextFromSermonPreview({
      id: '11111111-1111-4111-8111-111111111111',
      title: '',
      speaker: null,
      date: null,
      source: 'sermons',
      watchUrl: null,
      youtubeVideoId: null,
    });
    assert.equal(ctx.sermonTitle, null);
  });

  it('round-trips new-note query params', () => {
    const path = notesNewPath({
      sourceType: 'youtube',
      sourceRef: 'vid1',
      title: 'Notes — Test',
    });
    const q = path.split('?')[1] || '';
    const parsed = parseNotesNewSearch(q);
    assert.equal(parsed.sourceType, 'youtube');
    assert.equal(parsed.sourceRef, 'vid1');
  });
});

describe('privacy + client contracts', () => {
  it('states notes are private and has no share controls', () => {
    const index = readFileSync(join(root, 'pages/MemberNotes.tsx'), 'utf8');
    const editor = readFileSync(join(root, 'pages/MemberNoteEditor.tsx'), 'utf8');
    assert.ok(index.includes('private to your account'));
    assert.ok(editor.includes('private to your account'));
    assert.equal(/share|public|household|pastor-visible/i.test(index), false);
    assert.equal(/share with|make public|collaborate/i.test(editor), false);
  });

  it('client always writes auth user id and never accepts owner picker', () => {
    const src = readFileSync(join(root, 'lib/sermonNotesClient.ts'), 'utf8');
    assert.ok(src.includes('requireAuthUserId'));
    assert.ok(src.includes('user_id: userId'));
    assert.equal(/SERVICE_ROLE_KEY|createClient\([^)]*service/i.test(src), false);
    assert.equal(src.includes('ownerId'), false);
    assert.equal(src.includes('user_id: input'), false);
  });

  it('editor uses plain textarea (no HTML storage)', () => {
    const src = readFileSync(join(root, 'pages/MemberNoteEditor.tsx'), 'utf8');
    assert.ok(src.includes('<textarea'));
    assert.equal(src.includes('dangerouslySetInnerHTML'), false);
    assert.ok(src.includes('Delete this ${typeLabel.toLowerCase()}?'));
  });

  it('supports client-side search only', () => {
    const filtered = filterNotesClientSide(
      [
        { title: 'Grace', content: 'hello', sermonTitle: null, speakerName: null },
        { title: 'Other', content: 'world', sermonTitle: null, speakerName: null },
      ],
      'grace'
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].title, 'Grace');
  });
});

describe('API + SQL gate', () => {
  it('does not add a Connect API function for notes', () => {
    const apiDir = join(root, 'api');
    const files = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
    assert.equal(countApiJsHandlers(files), 15);
    assert.equal(existsSync(join(apiDir, 'sermon-notes.js')), false);
    assert.equal(existsSync(join(apiDir, 'notes.js')), false);
  });

  it('Connect ships no migrations of its own', () => {
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
  });

  it('Vault migration exists locally and is not applied by Connect', (t) => {
    if (!vaultRoot) {
      t.skip('PLCC Vault repo not checked out next to Connect (set VAULT_REPO to check it)');
      return;
    }
    const mig = join(vaultRoot, 'supabase/migrations/connect_phase_2_5_sermon_notes.sql');
    assert.equal(existsSync(mig), true);
    const sql = readFileSync(mig, 'utf8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.sermon_notes'));
    assert.ok(sql.includes('user_id = auth.uid()'));
    assert.ok(sql.includes('sermon_notes_select_own'));
    assert.ok(sql.includes('sermon_notes_insert_own'));
    assert.ok(sql.includes('sermon_notes_update_own'));
    assert.ok(sql.includes('sermon_notes_delete_own'));
    assert.ok(sql.includes('REVOKE ALL ON TABLE public.sermon_notes FROM anon'));
    assert.equal(sql.includes('public') && /FOR SELECT[\s\S]*TO anon/i.test(sql), false);
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
  });
});

describe('My Notes & Journal', () => {
  const ui = readFileSync(join(root, 'lib/sermonNotesUi.ts'), 'utf8');
  const client = readFileSync(join(root, 'lib/sermonNotesClient.ts'), 'utf8');
  const editor = readFileSync(join(root, 'pages/MemberNoteEditor.tsx'), 'utf8');
  const index = readFileSync(join(root, 'pages/MemberNotes.tsx'), 'utf8');

  it('has four entry types, with existing notes treated as sermon notes', () => {
    const types = readFileSync(join(root, 'lib/sermonNotesTypes.ts'), 'utf8');
    assert.ok(types.includes("['sermon', 'prayer', 'reflection', 'gratitude']"));
    assert.ok(ui.includes("return (NOTE_ENTRY_TYPES as string[]).includes(s) ? (s as NoteEntryType) : 'sermon'"));
  });

  it('answered fields are only ever written for prayers', () => {
    assert.ok(client.includes("const isPrayer = entryType === 'prayer'"));
    assert.ok(client.includes('isPrayer && fields.answeredAt'));
    assert.ok(client.includes('isPrayer && answeredAt'));
  });

  it('keeps working before the journal columns exist', () => {
    assert.ok(client.includes('LEGACY_COLUMNS'));
    assert.ok(client.includes('isMissingJournalColumn'));
    assert.ok(client.includes("'journal_unavailable'"));
    assert.ok(ui.includes("case 'journal_unavailable':"));
  });

  it('editor offers types, optional prompts and Mark answered with big buttons', () => {
    assert.ok(editor.includes('What is this?'));
    assert.ok(editor.includes('min-h-[52px]'));
    assert.ok(editor.includes('Need a starting point? Tap one (optional)'));
    assert.ok(editor.includes('Mark this prayer answered'));
    assert.ok(editor.includes('How God answered (optional)'));
    assert.ok(editor.includes('Not answered yet'));
  });

  it('list has filters including Answered and a Write a prayer button', () => {
    assert.ok(index.includes('My Notes & Journal'));
    assert.ok(index.includes('Write a prayer'));
    assert.ok(index.includes('filterNotesByType'));
    assert.ok(ui.includes("{ key: 'answered', label: 'Answered' }"));
  });

  it('new prayer link round-trips the entry type', () => {
    const path = notesNewPath({ sourceType: 'manual', entryType: 'prayer' });
    assert.equal(path, '/notes/new?type=prayer');
    assert.equal(parseNotesNewSearch('type=prayer').entryType, 'prayer');
    assert.equal(notesNewPath({ sourceType: 'manual' }), '/notes/new');
  });

  it('Vault migration adds the journal columns without touching RLS', (t) => {
    if (!vaultRoot) {
      t.skip('PLCC Vault repo not checked out next to Connect');
      return;
    }
    const sql = readFileSync(join(vaultRoot, 'supabase/migrations/connect_notes_journal.sql'), 'utf8');
    assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS entry_type'));
    assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS answered_at'));
    assert.ok(sql.includes("CHECK (entry_type = 'prayer' OR (answered_at IS NULL AND answer_note IS NULL))"));
    assert.equal(/CREATE POLICY|DISABLE ROW LEVEL/i.test(sql), false);
  });
});
