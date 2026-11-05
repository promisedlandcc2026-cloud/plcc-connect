/**
 * List production dist chunk sizes (raw + gzip). Dev-only reporting helper.
 * Run after `npm run build`: node scripts/report-bundle.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'dist/assets');

if (!existsSync(assets)) {
  console.error('No dist/assets — run npm run build first.');
  process.exit(1);
}

const rows = readdirSync(assets)
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => {
    const buf = readFileSync(join(assets, f));
    return {
      file: f,
      rawKb: +(buf.length / 1024).toFixed(2),
      gzipKb: +(gzipSync(buf).length / 1024).toFixed(2),
    };
  })
  .sort((a, b) => b.rawKb - a.rawKb);

console.log('PLCC Connect production assets\n');
for (const r of rows) {
  console.log(`${r.file.padEnd(42)} raw ${String(r.rawKb).padStart(8)} kB  gzip ${String(r.gzipKb).padStart(7)} kB`);
}
const js = rows.filter((r) => r.file.endsWith('.js'));
const initialish = js.filter(
  (r) =>
    r.file.startsWith('index-') ||
    r.file.startsWith('vendor-react') ||
    r.file.startsWith('vendor-supabase')
);
const initialRaw = initialish.reduce((s, r) => s + r.rawKb, 0);
const initialGzip = initialish.reduce((s, r) => s + r.gzipKb, 0);
console.log('\nApprox initial-related JS (index + vendor-react + vendor-supabase):');
console.log(`  raw ${initialRaw.toFixed(2)} kB  gzip ${initialGzip.toFixed(2)} kB`);
