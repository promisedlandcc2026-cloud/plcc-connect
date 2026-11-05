/**
 * Word search across the bundled KJV (public domain). Loads books a few at a time, so
 * the first results show quickly; book files are cached by the browser after that.
 */
import { BIBLE_BOOKS } from './bibleBooks';
import { loadKjvBookText } from './bibleClient';
import { buildMatcher } from './bibleSearchMatch';

export { buildMatcher };

export type SearchHit = { bookId: string; chapter: number; verse: number; text: string };
export type SearchProgress = { hits: SearchHit[]; booksDone: number; booksTotal: number; done: boolean; capped: boolean };

const MAX_HITS = 200;
const BATCH = 6;

export async function searchKjv(
  query: string,
  onProgress: (p: SearchProgress) => void,
  signal?: { cancelled: boolean }
): Promise<void> {
  const match = buildMatcher(query);
  const total = BIBLE_BOOKS.length;
  const hits: SearchHit[] = [];
  if (!match) {
    onProgress({ hits, booksDone: total, booksTotal: total, done: true, capped: false });
    return;
  }
  let done = 0;
  for (let i = 0; i < total; i += BATCH) {
    if (signal?.cancelled) return;
    const batch = BIBLE_BOOKS.slice(i, i + BATCH);
    const texts = await Promise.all(batch.map((b) => loadKjvBookText(b.id).catch(() => null)));
    if (signal?.cancelled) return;
    batch.forEach((b, bi) => {
      const chapters = texts[bi];
      if (!chapters) return;
      chapters.forEach((verses, ci) => {
        verses.forEach((text, vi) => {
          if (hits.length < MAX_HITS && match(text)) hits.push({ bookId: b.id, chapter: ci + 1, verse: vi + 1, text });
        });
      });
    });
    done += batch.length;
    const capped = hits.length >= MAX_HITS;
    onProgress({ hits: [...hits], booksDone: done, booksTotal: total, done: capped || done >= total, capped });
    if (capped) return;
  }
}
