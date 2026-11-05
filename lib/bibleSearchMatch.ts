/** Standalone (no imports) so tests can load it directly. */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words must all appear in a verse (any order). Whole-word match on the start: "love" finds "loved", not "glove". */
export function buildMatcher(query: string): ((text: string) => boolean) | null {
  const words = query
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
  if (words.length === 0) return null;
  const res = words.map((w) => new RegExp(`\\b${escapeRe(w)}`, 'i'));
  return (text) => res.every((re) => re.test(text));
}
